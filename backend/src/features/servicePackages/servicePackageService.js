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
      published:
        booleanValue(
          payload.published,
          false
        ),
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
