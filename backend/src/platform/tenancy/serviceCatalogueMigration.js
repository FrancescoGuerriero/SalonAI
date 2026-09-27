import mongoose from "mongoose";

function migrationError(
  message,
  code = "INVALID_SERVICE_CATALOGUE_MIGRATION"
) {
  const error =
    new Error(
      message
    );
  error.code =
    code;
  error.statusCode =
    400;
  return error;
}

function idText(value) {
  const candidate =
    value &&
    typeof value ===
      "object" &&
    "_id" in value
      ? value._id
      : value;

  return String(
    candidate || ""
  ).trim();
}

function requiredId(
  value,
  label
) {
  const id =
    idText(
      value
    );

  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    throw migrationError(
      `${label} must be a valid ObjectId.`
    );
  }

  return id;
}

function addBlocker(
  blockers,
  recordType,
  recordId,
  blocker
) {
  blockers.push({
    recordType,
    recordId:
      recordId ||
      null,
    blocker,
  });
}

export function buildServiceCatalogueReadiness({
  businesses = [],
  locations = [],
  services = [],
  offerings = [],
  businessId,
  primaryLocationId,
} = {}) {
  const targetBusinessId =
    requiredId(
      businessId,
      "businessId"
    );
  const targetLocationId =
    requiredId(
      primaryLocationId,
      "primaryLocationId"
    );

  const blockers = [];
  const businessIds =
    (
      Array.isArray(
        businesses
      )
        ? businesses
        : []
    )
      .map(
        idText
      )
      .filter(Boolean);

  const canonicalBusinessCount =
    businessIds.filter(
      (id) =>
        id ===
        targetBusinessId
    ).length;
  const otherBusinessCount =
    businessIds.filter(
      (id) =>
        id !==
        targetBusinessId
    ).length;

  if (
    businessIds.length !==
      1 ||
    canonicalBusinessCount !==
      1 ||
    otherBusinessCount !==
      0
  ) {
    addBlocker(
      blockers,
      "scope",
      null,
      "global-unowned-service-scope-not-single-tenant"
    );
  }

  const locationById =
    new Map(
      (
        Array.isArray(
          locations
        )
          ? locations
          : []
      ).map(
        (location) => [
          idText(
            location?._id
          ),
          location,
        ]
      )
    );

  const primaryLocation =
    locationById.get(
      targetLocationId
    );

  if (!primaryLocation) {
    addBlocker(
      blockers,
      "scope",
      null,
      "primary-location-missing"
    );
  } else if (
    idText(
      primaryLocation.business
    ) !==
      targetBusinessId
  ) {
    addBlocker(
      blockers,
      "scope",
      null,
      "primary-location-owned-by-other-business"
    );
  }

  const servicePlans = [];
  const serviceById =
    new Map();

  for (
    const service of
      Array.isArray(
        services
      )
        ? services
        : []
  ) {
    const serviceId =
      requiredId(
        service?._id,
        "service._id"
      );
    const currentBusinessId =
      idText(
        service?.business
      );

    serviceById.set(
      serviceId,
      service
    );

    let businessAction =
      "assign";

    if (
      currentBusinessId ===
        targetBusinessId
    ) {
      businessAction =
        "reuse";
    } else if (
      currentBusinessId
    ) {
      businessAction =
        "conflict";
      addBlocker(
        blockers,
        "service",
        serviceId,
        "service-owned-by-other-business"
      );
    }

    servicePlans.push(
      Object.freeze({
        serviceId,
        businessAction,
        previousBusinessId:
          currentBusinessId ||
          null,
      })
    );
  }

  const tupleCounts =
    new Map();
  const offeringPlans = [];

  for (
    const offering of
      Array.isArray(
        offerings
      )
        ? offerings
        : []
  ) {
    const offeringId =
      requiredId(
        offering?._id,
        "offering._id"
      );
    const offeringBusinessId =
      idText(
        offering?.business
      );
    const locationId =
      idText(
        offering?.location
      );
    const serviceId =
      idText(
        offering?.service
      );

    const location =
      locationById.get(
        locationId
      );
    const service =
      serviceById.get(
        serviceId
      );

    const tuple =
      [
        offeringBusinessId,
        locationId,
        serviceId,
      ].join(":");

    tupleCounts.set(
      tuple,
      (
        tupleCounts.get(
          tuple
        ) ||
        0
      ) +
        1
    );

    if (
      offeringBusinessId !==
        targetBusinessId
    ) {
      addBlocker(
        blockers,
        "offering",
        offeringId,
        "offering-owned-by-other-business"
      );
    }

    if (!location) {
      addBlocker(
        blockers,
        "offering",
        offeringId,
        "offering-location-missing"
      );
    } else if (
      idText(
        location.business
      ) !==
        targetBusinessId
    ) {
      addBlocker(
        blockers,
        "offering",
        offeringId,
        "offering-location-owned-by-other-business"
      );
    }

    if (!service) {
      addBlocker(
        blockers,
        "offering",
        offeringId,
        "offering-service-missing"
      );
    } else {
      const serviceBusinessId =
        idText(
          service.business
        );

      if (
        serviceBusinessId &&
        serviceBusinessId !==
          targetBusinessId
      ) {
        addBlocker(
          blockers,
          "offering",
          offeringId,
          "offering-service-owned-by-other-business"
        );
      }
    }

    offeringPlans.push(
      Object.freeze({
        offeringId,
        businessId:
          offeringBusinessId ||
          null,
        locationId:
          locationId ||
          null,
        serviceId:
          serviceId ||
          null,
      })
    );
  }

  for (
    const [
      tuple,
      count,
    ] of
      tupleCounts
  ) {
    if (
      count >
      1
    ) {
      addBlocker(
        blockers,
        "offering",
        null,
        "duplicate-business-location-service-offering"
      );
    }
  }

  const businessAssignments =
    servicePlans.filter(
      (plan) =>
        plan.businessAction ===
        "assign"
    ).length;
  const alreadyBusinessOwned =
    servicePlans.filter(
      (plan) =>
        plan.businessAction ===
        "reuse"
    ).length;

  return Object.freeze({
    businessId:
      targetBusinessId,
    primaryLocationId:
      targetLocationId,
    safeForBusinessBackfill:
      blockers.length ===
      0,
    scope:
      Object.freeze({
        businessCount:
          businessIds.length,
        canonicalBusinessCount,
        otherBusinessCount,
      }),
    summary:
      Object.freeze({
        services:
          servicePlans.length,
        businessAssignments,
        alreadyBusinessOwned,
        offerings:
          offeringPlans.length,
        blockers:
          blockers.length,
      }),
    servicePlans:
      Object.freeze(
        servicePlans
      ),
    offeringPlans:
      Object.freeze(
        offeringPlans
      ),
    blockers:
      Object.freeze(
        blockers.map(
          (blocker) =>
            Object.freeze({
              ...blocker,
            })
        )
      ),
  });
}

export default {
  buildServiceCatalogueReadiness,
};
