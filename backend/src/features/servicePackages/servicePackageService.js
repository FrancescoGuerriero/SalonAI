import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import Service from "../../models/service.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import CustomerServicePackage from "./CustomerServicePackage.js";
import ServicePackage from "./ServicePackage.js";
import ServicePackageRedemption from "./ServicePackageRedemption.js";
import { isFeatureEnabled } from "../../services/featureControlService.js";

function actorId(actor) {
  return (
    actor?._id ||
    actor?.id ||
    null
  );
}

function objectId(value, field) {
  const candidate = String(
    value || ""
  ).trim();

  if (
    !mongoose.isValidObjectId(
      candidate
    )
  ) {
    throw createServiceError(
      `${field} must be a valid identifier.`,
      400,
      {
        field,
      }
    );
  }

  return candidate;
}

function text(value, maximum = 2000) {
  return String(value || "")
    .trim()
    .slice(0, maximum);
}

function booleanValue(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  return [
    "true",
    "1",
    "yes",
    "on",
  ].includes(
    String(value)
      .trim()
      .toLowerCase()
  );
}

function positiveInteger(
  value,
  field,
  {
    minimum = 1,
    maximum = 3650,
  } = {}
) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw createServiceError(
      `${field} must be an integer between ${minimum} and ${maximum}.`,
      400,
      {
        field,
      }
    );
  }

  return parsed;
}

function money(value, field = "price") {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    throw createServiceError(
      `${field} must be a non-negative number.`,
      400,
      {
        field,
      }
    );
  }

  return Number(
    parsed.toFixed(2)
  );
}

async function normaliseIncludedServices(
  items,
  {
    session = null,
  } = {}
) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw createServiceError(
      "A service package must contain at least one service.",
      400,
      {
        field:
          "includedServices",
      }
    );
  }

  const normalised = [];
  const seen = new Set();

  for (const item of items) {
    const serviceId =
      objectId(
        item?.service ||
          item?.serviceId,
        "service"
      );

    if (seen.has(serviceId)) {
      throw createServiceError(
        "A service can appear only once in a package.",
        409,
        {
          field:
            "includedServices",
          service:
            serviceId,
        }
      );
    }

    seen.add(serviceId);
    normalised.push({
      service:
        serviceId,
      sessions:
        positiveInteger(
          item?.sessions,
          "sessions",
          {
            maximum: 100,
          }
        ),
    });
  }

  let serviceQuery =
    Service.find({
      _id: {
        $in:
          normalised.map(
            (item) =>
              item.service
          ),
      },
      active: true,
    }).select(
      "_id name active"
    );

  if (session) {
    serviceQuery =
      serviceQuery.session(
        session
      );
  }

  const services =
    await serviceQuery.lean();

  if (
    services.length !==
    normalised.length
  ) {
    throw createServiceError(
      "Every package service must exist and be active.",
      409,
      {
        field:
          "includedServices",
      }
    );
  }

  return normalised;
}

function includedServiceIds(
  items = []
) {
  return [
    ...new Set(
      items
        .map((item) =>
          String(
            item?.service?._id ||
              item?.service ||
              ""
          ).trim()
        )
        .filter(Boolean)
    ),
  ];
}

async function purchasableServiceIdSet(
  items = []
) {
  const serviceIds =
    includedServiceIds(items);

  if (
    serviceIds.length === 0
  ) {
    return new Set();
  }

  const services =
    await Service.find({
      _id: {
        $in: serviceIds,
      },
      active: true,
      bookable: true,
    })
      .select("_id")
      .lean();

  return new Set(
    services.map(
      (service) =>
        String(service._id)
    )
  );
}

async function assertPurchasableIncludedServices(
  items = []
) {
  const serviceIds =
    includedServiceIds(items);
  const eligible =
    await purchasableServiceIdSet(
      items
    );

  if (
    serviceIds.length === 0 ||
    eligible.size !==
      serviceIds.length
  ) {
    throw createServiceError(
      "Every published or purchased package service must be active and globally bookable.",
      409,
      {
        field:
          "includedServices",
      }
    );
  }
}

async function populateDefinition(
  definitionId
) {
  return ServicePackage.findById(
    definitionId
  )
    .populate(
      "includedServices.service",
      "name category price duration active bookable published"
    )
    .lean();
}

async function populateEntitlement(
  entitlementId
) {
  return CustomerServicePackage
    .findById(
      entitlementId
    )
    .populate(
      "servicePackage",
      "code name description price validityDays active published"
    )
    .populate(
      "customer",
      "firstName lastName preferredName email phone status"
    )
    .populate(
      "credits.service",
      "name category duration active bookable"
    )
    .populate(
      "order",
      "orderNumber status total paidAt"
    )
    .populate(
      "payment",
      "provider status amount paidAt"
    )
    .lean();
}

function totalRemaining(
  entitlement
) {
  return (
    entitlement?.credits || []
  ).reduce(
    (sum, credit) =>
      sum +
      Math.max(
        0,
        Number(
          credit.remaining
        ) || 0
      ),
    0
  );
}

function refreshEntitlementStatus(
  entitlement,
  now = new Date()
) {
  if (
    entitlement.status ===
    "cancelled"
  ) {
    return;
  }

  if (
    new Date(
      entitlement.expiresAt
    ) <= now
  ) {
    entitlement.status =
      "expired";
    return;
  }

  entitlement.status =
    totalRemaining(
      entitlement
    ) > 0
      ? "active"
      : "exhausted";
}

export async function createServicePackage(
  payload = {},
  actor = null
) {
  const code = text(
    payload.code,
    40
  ).toUpperCase();
  const name = text(
    payload.name,
    160
  );

  if (!code || !name) {
    throw createServiceError(
      "Package code and name are required.",
      400
    );
  }

  const includedServices =
    await normaliseIncludedServices(
      payload.includedServices
    );

  const published =
    booleanValue(
      payload.published,
      false
    );

  if (published) {
    await assertPurchasableIncludedServices(
      includedServices
    );
  }

  const definition =
    await ServicePackage.create({
      code,
      name,
      description:
        text(
          payload.description,
          2000
        ),
      includedServices,
      price: money(
        payload.price
      ),
      validityDays:
        positiveInteger(
          payload.validityDays ??
            365,
          "validityDays"
        ),
      active:
        booleanValue(
          payload.active,
          true
        ),
      published,
      createdBy:
        actorId(actor),
      updatedBy:
        actorId(actor),
    });

  return populateDefinition(
    definition._id
  );
}

export async function updateServicePackage(
  definitionId,
  payload = {},
  actor = null
) {
  objectId(
    definitionId,
    "servicePackage"
  );

  const definition =
    assertFound(
      await ServicePackage.findById(
        definitionId
      ),
      "Service package not found."
    );

  if (
    payload.code !== undefined
  ) {
    const code = text(
      payload.code,
      40
    ).toUpperCase();

    if (!code) {
      throw createServiceError(
        "Package code cannot be empty.",
        400,
        {
          field: "code",
        }
      );
    }

    definition.code = code;
  }

  if (
    payload.name !== undefined
  ) {
    const name = text(
      payload.name,
      160
    );

    if (!name) {
      throw createServiceError(
        "Package name cannot be empty.",
        400,
        {
          field: "name",
        }
      );
    }

    definition.name = name;
  }

  if (
    payload.description !==
    undefined
  ) {
    definition.description =
      text(
        payload.description,
        2000
      );
  }

  if (
    payload.includedServices !==
    undefined
  ) {
    definition.includedServices =
      await normaliseIncludedServices(
        payload.includedServices
      );
  }

  if (
    payload.price !== undefined
  ) {
    definition.price =
      money(payload.price);
  }

  if (
    payload.validityDays !==
    undefined
  ) {
    definition.validityDays =
      positiveInteger(
        payload.validityDays,
        "validityDays"
      );
  }

  if (
    payload.active !== undefined
  ) {
    definition.active =
      booleanValue(
        payload.active
      );
  }

  if (
    payload.published !==
    undefined
  ) {
    definition.published =
      booleanValue(
        payload.published
      );
  }

  if (definition.published) {
    await assertPurchasableIncludedServices(
      definition.includedServices
    );
  }

  definition.updatedBy =
    actorId(actor);

  await definition.save();

  return populateDefinition(
    definition._id
  );
}

export async function listServicePackages(
  query = {}
) {
  const match = {};

  if (
    query.active !== undefined
  ) {
    match.active =
      booleanValue(
        query.active
      );
  }

  if (
    query.published !== undefined
  ) {
    match.published =
      booleanValue(
        query.published
      );
  }

  return ServicePackage.find(
    match
  )
    .populate(
      "includedServices.service",
      "name category price duration active bookable published"
    )
    .sort({
      active: -1,
      name: 1,
      _id: 1,
    })
    .lean();
}

export async function listPublishedServicePackages() {
  const definitions =
    await ServicePackage.find({
      active: true,
      published: true,
    })
      .select(
        "code name description includedServices price validityDays"
      )
      .populate(
        "includedServices.service",
        "name category price duration"
      )
      .sort({
        name: 1,
        _id: 1,
      })
      .lean();

  const allCredits =
    definitions.flatMap(
      (definition) =>
        definition.includedServices ||
        []
    );
  const eligible =
    await purchasableServiceIdSet(
      allCredits
    );

  return definitions.filter(
    (definition) =>
      (
        definition.includedServices ||
        []
      ).length > 0 &&
      (
        definition.includedServices ||
        []
      ).every((credit) =>
        eligible.has(
          String(
            credit?.service?._id ||
              credit?.service ||
              ""
          )
        )
      )
  );
}

function customerProfileId(user) {
  const value =
    user?.customerProfile?._id ||
    user?.customerProfile ||
    null;

  if (!value) {
    throw createServiceError(
      "A linked customer profile is required for service-package purchases.",
      409,
      {
        code: "CUSTOMER_PROFILE_REQUIRED",
      }
    );
  }

  return objectId(
    value,
    "customer"
  );
}

export async function listMyServicePackages(
  user,
  query = {}
) {
  const items =
    await listCustomerPackages(
      customerProfileId(user),
      query
    );

  return items.map(
    (item) => ({
      _id: item._id,
      servicePackage:
        item.servicePackage,
      credits: item.credits,
      validFrom:
        item.validFrom,
      expiresAt:
        item.expiresAt,
      status: item.status,
      source: item.source,
      grantedPrice:
        item.grantedPrice,
      createdAt:
        item.createdAt,
      updatedAt:
        item.updatedAt,
    })
  );
}

/*
 * Build server-authoritative checkout lines. Client-supplied names, prices,
 * validity and credits are deliberately ignored.
 */
export async function buildPurchasableServicePackageOrderItems(
  items = [],
  user = null
) {
  customerProfileId(user);

  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  if (
    !(await isFeatureEnabled(
      "service-packages"
    ))
  ) {
    const error =
      createServiceError(
        "New service-package purchases are currently disabled by the salon administrator.",
        404,
        {
          featureId:
            "service-packages",
        }
      );
    error.code =
      "FEATURE_DISABLED";
    throw error;
  }

  const requestedIds = [];
  const seen = new Set();

  for (const item of items) {
    const packageId = objectId(
      item?.servicePackage ||
        item?.servicePackageId ||
        item?.packageId,
      "servicePackage"
    );
    const quantity = Number.parseInt(
      item?.quantity ?? 1,
      10
    );

    if (quantity !== 1) {
      throw createServiceError(
        "Each service package can be purchased once per checkout.",
        400,
        {
          field: "quantity",
          servicePackage: packageId,
        }
      );
    }

    if (seen.has(packageId)) {
      throw createServiceError(
        "A service package can appear only once in a checkout.",
        409,
        {
          servicePackage: packageId,
        }
      );
    }

    seen.add(packageId);
    requestedIds.push(packageId);
  }

  const definitions = await ServicePackage.find({
    _id: {
      $in: requestedIds,
    },
    active: true,
    published: true,
  }).lean();

  if (definitions.length !== requestedIds.length) {
    throw createServiceError(
      "One or more selected service packages are unavailable for purchase.",
      409
    );
  }

  await assertPurchasableIncludedServices(
    definitions.flatMap(
      (definition) =>
        definition.includedServices ||
        []
    )
  );

  const byId = new Map(
    definitions.map((definition) => [
      String(definition._id),
      definition,
    ])
  );

  return requestedIds.map((packageId) => {
    const definition = byId.get(packageId);
    const includedServices = (
      definition.includedServices || []
    ).map((credit) => ({
      service: credit.service,
      sessions: positiveInteger(
        credit.sessions,
        "sessions",
        {
          maximum: 100,
        }
      ),
    }));

    if (includedServices.length === 0) {
      throw createServiceError(
        `${definition.name} is not configured with redeemable service credits.`,
        409
      );
    }

    const price = money(
      definition.price
    );

    return {
      itemType: "service_package",
      servicePackage: definition._id,
      packageSnapshot: {
        validityDays: positiveInteger(
          definition.validityDays,
          "validityDays"
        ),
        includedServices,
      },
      sku: `PACKAGE-${definition.code}`,
      name: definition.name,
      image: "",
      quantity: 1,
      unitPrice: price,
      lineTotal: price,
    };
  });
}

/*
 * Fulfil paid package lines idempotently. Each order/package pair is protected
 * by the model's unique partial index, while $setOnInsert makes retries safe.
 * Allocation uses the immutable order snapshot rather than the mutable
 * catalogue definition.
 */
export async function allocatePaidOrderServicePackages(
  order,
  payment = null,
  {
    paidAt = new Date(),
  } = {}
) {
  const packageItems = (
    order?.items || []
  ).filter(
    (item) =>
      String(item?.itemType || "") ===
      "service_package"
  );

  if (packageItems.length === 0) {
    return [];
  }

  const customerId = objectId(
    order?.customer,
    "customer"
  );
  const orderId = objectId(
    order?._id,
    "order"
  );
  const paymentId = payment?._id || payment || order?.payment || null;
  const validFrom = new Date(paidAt);

  if (Number.isNaN(validFrom.getTime())) {
    throw createServiceError(
      "Paid service-package allocation requires a valid settlement date.",
      500
    );
  }

  const entitlements = [];

  for (const item of packageItems) {
    const packageId = objectId(
      item?.servicePackage,
      "servicePackage"
    );
    const snapshot =
      item?.packageSnapshot ||
      {};
    const validityDays = positiveInteger(
      snapshot.validityDays,
      "validityDays"
    );
    const credits = (
      snapshot.includedServices || []
    ).map((credit) => ({
      service: objectId(
        credit?.service,
        "service"
      ),
      purchased: positiveInteger(
        credit?.sessions,
        "sessions",
        {
          maximum: 100,
        }
      ),
      remaining: positiveInteger(
        credit?.sessions,
        "sessions",
        {
          maximum: 100,
        }
      ),
    }));

    if (credits.length === 0) {
      throw createServiceError(
        "A paid package order line has no entitlement credits.",
        500
      );
    }

    const expiresAt = new Date(
      validFrom.getTime() +
        validityDays *
          24 *
          60 *
          60 *
          1000
    );

    const filter = {
      order: orderId,
      servicePackage: packageId,
      source: "order",
    };

    try {
      const entitlement =
        await CustomerServicePackage.findOneAndUpdate(
          filter,
          {
            $setOnInsert: {
              customer: customerId,
              servicePackage: packageId,
              credits,
              validFrom,
              expiresAt,
              status: "active",
              source: "order",
              order: orderId,
              payment: paymentId || null,
              grantedPrice: money(
                item?.lineTotal ??
                  item?.unitPrice
              ),
              grantReason: "",
              assignedBy: null,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

      entitlements.push(
        entitlement
      );
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      /*
       * A concurrent settlement attempt may win the unique-index race.
       * Returning the existing entitlement is the correct idempotent result.
       */
      entitlements.push(
        assertFound(
          await CustomerServicePackage.findOne(
            filter
          ),
          "Paid package entitlement could not be reconciled."
        )
      );
    }
  }

  return entitlements;
}

export async function grantServicePackage(
  definitionId,
  payload = {},
  actor = null
) {
  objectId(
    definitionId,
    "servicePackage"
  );
  const customerId =
    objectId(
      payload.customer ||
        payload.customerId,
      "customer"
    );
  const reason = text(
    payload.reason,
    500
  );

  if (!reason) {
    throw createServiceError(
      "A reason is required when a package is granted manually.",
      400,
      {
        field: "reason",
      }
    );
  }

  const definition =
    assertFound(
      await ServicePackage.findOne({
        _id: definitionId,
        active: true,
      }).lean(),
      "Active service package not found."
    );

  assertFound(
    await Customer.findOne({
      _id: customerId,
      status: {
        $ne: "deleted",
      },
    }).select("_id"),
    "Customer not found."
  );

  const validFrom =
    payload.validFrom
      ? new Date(
          payload.validFrom
        )
      : new Date();

  if (
    Number.isNaN(
      validFrom.getTime()
    )
  ) {
    throw createServiceError(
      "validFrom must be a valid date.",
      400,
      {
        field:
          "validFrom",
      }
    );
  }

  const expiresAt =
    payload.expiresAt
      ? new Date(
          payload.expiresAt
        )
      : new Date(
          validFrom.getTime() +
            definition.validityDays *
              24 *
              60 *
              60 *
              1000
        );

  if (
    Number.isNaN(
      expiresAt.getTime()
    ) ||
    expiresAt <= validFrom
  ) {
    throw createServiceError(
      "Package expiry must be after its valid-from date.",
      400,
      {
        field:
          "expiresAt",
      }
    );
  }

  const entitlement =
    await CustomerServicePackage.create({
      customer:
        customerId,
      servicePackage:
        definition._id,
      credits:
        definition.includedServices.map(
          (item) => ({
            service:
              item.service,
            purchased:
              item.sessions,
            remaining:
              item.sessions,
          })
        ),
      validFrom,
      expiresAt,
      status: "active",
      source: "manual",
      grantedPrice:
        payload.grantedPrice ===
        undefined
          ? money(
              definition.price
            )
          : money(
              payload.grantedPrice,
              "grantedPrice"
            ),
      grantReason: reason,
      assignedBy:
        actorId(actor),
    });

  return populateEntitlement(
    entitlement._id
  );
}

export async function listCustomerPackages(
  customerId,
  query = {}
) {
  objectId(
    customerId,
    "customer"
  );

  const now = new Date();

  await CustomerServicePackage.updateMany(
    {
      customer: customerId,
      status: "active",
      expiresAt: {
        $lte: now,
      },
    },
    {
      $set: {
        status: "expired",
      },
    }
  );

  const match = {
    customer: customerId,
  };

  if (query.status) {
    match.status = text(
      query.status,
      30
    ).toLowerCase();
  }

  return CustomerServicePackage
    .find(match)
    .populate(
      "servicePackage",
      "code name description price validityDays active published"
    )
    .populate(
      "credits.service",
      "name category duration active bookable"
    )
    .sort({
      createdAt: -1,
    })
    .lean();
}

export async function redeemServicePackage(
  entitlementId,
  payload = {},
  actor = null
) {
  objectId(
    entitlementId,
    "entitlement"
  );
  const appointmentId =
    objectId(
      payload.appointment ||
        payload.appointmentId,
      "appointment"
    );

  const session =
    await mongoose.startSession();
  let redemptionId;
  let entitlementResultId;

  try {
    await session.withTransaction(
      async () => {
        const entitlement =
          assertFound(
            await CustomerServicePackage
              .findById(
                entitlementId
              )
              .session(
                session
              ),
            "Customer service package not found."
          );

        refreshEntitlementStatus(
          entitlement
        );

        if (
          entitlement.status !==
          "active"
        ) {
          throw createServiceError(
            `This package entitlement is ${entitlement.status}.`,
            409,
            {
              status:
                entitlement.status,
            }
          );
        }

        const now = new Date();

        if (
          entitlement.validFrom > now
        ) {
          throw createServiceError(
            "This package entitlement is not valid yet.",
            409
          );
        }

        const appointment =
          assertFound(
            await Appointment
              .findById(
                appointmentId
              )
              .select(
                "customer service status"
              )
              .session(
                session
              ),
            "Appointment not found."
          );

        if (
          [
            "cancelled",
            "no_show",
          ].includes(
            appointment.status
          )
        ) {
          throw createServiceError(
            `A ${appointment.status} appointment cannot consume a package session.`,
            409
          );
        }

        if (
          String(
            appointment.customer
          ) !==
          String(
            entitlement.customer
          )
        ) {
          throw createServiceError(
            "The package belongs to a different customer.",
            409
          );
        }

        const existing =
          await ServicePackageRedemption
            .findOne({
              appointment:
                appointment._id,
              status: "active",
            })
            .session(
              session
            );

        if (existing) {
          throw createServiceError(
            "This appointment already has an active package redemption.",
            409,
            {
              redemption:
                existing._id,
            }
          );
        }

        const credit =
          entitlement.credits.find(
            (item) =>
              String(item.service) ===
              String(
                appointment.service
              )
          );

        if (!credit) {
          throw createServiceError(
            "This package does not cover the appointment service.",
            409
          );
        }

        if (
          Number(
            credit.remaining
          ) < 1
        ) {
          throw createServiceError(
            "No package sessions remain for this service.",
            409
          );
        }

        credit.remaining -= 1;
        refreshEntitlementStatus(
          entitlement,
          now
        );
        await entitlement.save({
          session,
        });

        const [redemption] =
          await ServicePackageRedemption.create(
            [
              {
                entitlement:
                  entitlement._id,
                servicePackage:
                  entitlement.servicePackage,
                customer:
                  entitlement.customer,
                service:
                  appointment.service,
                appointment:
                  appointment._id,
                sessions: 1,
                status: "active",
                redeemedBy:
                  actorId(actor),
                redeemedAt: now,
              },
            ],
            {
              session,
            }
          );

        redemptionId =
          redemption._id;
        entitlementResultId =
          entitlement._id;
      }
    );
  } finally {
    await session.endSession();
  }

  const [
    entitlement,
    redemption,
  ] = await Promise.all([
    populateEntitlement(
      entitlementResultId
    ),
    ServicePackageRedemption
      .findById(redemptionId)
      .populate(
        "appointment",
        "appointmentDate appointmentTime startsAt endsAt status bookingSource"
      )
      .populate(
        "service",
        "name category duration"
      )
      .lean(),
  ]);

  return {
    entitlement,
    redemption,
  };
}

export async function reverseServicePackageRedemption(
  redemptionId,
  payload = {},
  actor = null
) {
  objectId(
    redemptionId,
    "redemption"
  );
  const reason = text(
    payload.reason,
    500
  );

  if (!reason) {
    throw createServiceError(
      "A reversal reason is required.",
      400,
      {
        field: "reason",
      }
    );
  }

  const session =
    await mongoose.startSession();
  let entitlementResultId;

  try {
    await session.withTransaction(
      async () => {
        const redemption =
          assertFound(
            await ServicePackageRedemption
              .findOne({
                _id: redemptionId,
                status: "active",
              })
              .session(
                session
              ),
            "Active package redemption not found."
          );

        const entitlement =
          assertFound(
            await CustomerServicePackage
              .findById(
                redemption.entitlement
              )
              .session(
                session
              ),
            "Customer service package not found."
          );

        const credit =
          entitlement.credits.find(
            (item) =>
              String(item.service) ===
              String(
                redemption.service
              )
          );

        if (!credit) {
          throw createServiceError(
            "The entitlement no longer contains the redeemed service.",
            409
          );
        }

        credit.remaining =
          Math.min(
            Number(
              credit.purchased
            ),
            Number(
              credit.remaining
            ) +
              Number(
                redemption.sessions ||
                  1
              )
          );

        refreshEntitlementStatus(
          entitlement
        );
        await entitlement.save({
          session,
        });

        redemption.status =
          "reversed";
        redemption.reversedBy =
          actorId(actor);
        redemption.reversedAt =
          new Date();
        redemption.reversalReason =
          reason;
        await redemption.save({
          session,
        });

        entitlementResultId =
          entitlement._id;
      }
    );
  } finally {
    await session.endSession();
  }

  return {
    entitlement:
      await populateEntitlement(
        entitlementResultId
      ),
    redemption:
      await ServicePackageRedemption
        .findById(
          redemptionId
        )
        .populate(
          "appointment",
          "appointmentDate appointmentTime startsAt endsAt status"
        )
        .populate(
          "service",
          "name category duration"
        )
        .lean(),
  };
}

export async function listPackageRedemptions(
  entitlementId
) {
  objectId(
    entitlementId,
    "entitlement"
  );

  return ServicePackageRedemption
    .find({
      entitlement:
        entitlementId,
    })
    .populate(
      "appointment",
      "appointmentDate appointmentTime startsAt endsAt status bookingSource"
    )
    .populate(
      "service",
      "name category duration"
    )
    .populate(
      "redeemedBy reversedBy",
      "name email role"
    )
    .sort({
      redeemedAt: -1,
    })
    .lean();
}
