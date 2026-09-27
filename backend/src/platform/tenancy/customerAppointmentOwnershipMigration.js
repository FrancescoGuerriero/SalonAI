import mongoose from "mongoose";

function ownershipError(
  message,
  code = "INVALID_CUSTOMER_APPOINTMENT_OWNERSHIP_PLAN"
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function idText(value) {
  const candidate =
    value &&
    typeof value === "object" &&
    "_id" in value
      ? value._id
      : value;

  return String(
    candidate || ""
  ).trim();
}

function requiredObjectId(
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
    throw ownershipError(
      `${label} must be a valid ObjectId.`
    );
  }

  return id;
}

function indexById(
  records = []
) {
  return new Map(
    (
      Array.isArray(records)
        ? records
        : []
    )
      .map(
        (record) => [
          idText(
            record
          ),
          record,
        ]
      )
      .filter(
        ([id]) =>
          Boolean(id)
      )
  );
}

function blocker(
  destination,
  {
    resourceType,
    resourceId = null,
    code,
  }
) {
  destination.push(
    Object.freeze({
      resourceType,
      resourceId:
        resourceId
          ? String(
              resourceId
            )
          : null,
      blocker:
        code,
    })
  );
}

export function buildCustomerAppointmentMigrationScope({
  businesses = [],
  locations = [],
  businessId,
  locationId,
} = {}) {
  const targetBusinessId =
    requiredObjectId(
      businessId,
      "businessId"
    );
  const targetLocationId =
    requiredObjectId(
      locationId,
      "locationId"
    );

  const businessIds =
    (
      Array.isArray(
        businesses
      )
        ? businesses
        : []
    )
      .map(
        (business) =>
          idText(
            business
          )
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

  const businessLocations =
    (
      Array.isArray(
        locations
      )
        ? locations
        : []
    ).filter(
      (location) =>
        idText(
          location?.business
        ) ===
          targetBusinessId &&
        String(
          location?.status ||
            "active"
        ) !==
          "archived"
    );

  const canonicalLocationCount =
    businessLocations.filter(
      (location) =>
        idText(
          location
        ) ===
        targetLocationId
    ).length;

  const customerBlockers = [];
  const appointmentBlockers = [];

  if (
    canonicalBusinessCount !==
      1
  ) {
    customerBlockers.push(
      "canonical-business-count-not-one"
    );
  }

  if (
    otherBusinessCount >
      0
  ) {
    customerBlockers.push(
      "additional-business-present"
    );
  }

  if (
    businessIds.length !==
      1
  ) {
    customerBlockers.push(
      "global-customer-scope-not-single-tenant"
    );
  }

  appointmentBlockers.push(
    ...customerBlockers
  );

  if (
    canonicalLocationCount !==
      1
  ) {
    appointmentBlockers.push(
      "canonical-location-count-not-one"
    );
  }

  if (
    businessLocations.length !==
      1
  ) {
    appointmentBlockers.push(
      "global-appointment-scope-not-single-location"
    );
  }

  return Object.freeze({
    businessId:
      targetBusinessId,
    locationId:
      targetLocationId,
    businessCount:
      businessIds.length,
    canonicalBusinessCount,
    otherBusinessCount,
    activeBusinessLocationCount:
      businessLocations.length,
    canonicalLocationCount,
    safeForGlobalCustomerBackfill:
      customerBlockers.length ===
        0,
    safeForGlobalAppointmentBackfill:
      appointmentBlockers.length ===
        0,
    customerBlockers:
      Object.freeze([
        ...new Set(
          customerBlockers
        ),
      ]),
    appointmentBlockers:
      Object.freeze([
        ...new Set(
          appointmentBlockers
        ),
      ]),
  });
}

export function buildCustomerAppointmentOwnershipReadiness({
  customers = [],
  appointments = [],
  services = [],
  stylists = [],
  businesses = [],
  locations = [],
  businessId,
  locationId,
} = {}) {
  const scope =
    buildCustomerAppointmentMigrationScope({
      businesses,
      locations,
      businessId,
      locationId,
    });

  const targetBusinessId =
    scope.businessId;
  const targetLocationId =
    scope.locationId;

  const customerById =
    indexById(
      customers
    );
  const serviceById =
    indexById(
      services
    );
  const stylistById =
    indexById(
      stylists
    );

  const blockers = [];
  const customerPlans = [];
  const appointmentPlans = [];

  if (
    !scope.safeForGlobalCustomerBackfill
  ) {
    blocker(
      blockers,
      {
        resourceType:
          "scope",
        code:
          "global-customer-scope-not-proven",
      }
    );
  }

  if (
    !scope.safeForGlobalAppointmentBackfill
  ) {
    blocker(
      blockers,
      {
        resourceType:
          "scope",
        code:
          "global-appointment-scope-not-proven",
      }
    );
  }

  for (
    const customer of
      Array.isArray(customers)
        ? customers
        : []
  ) {
    const customerId =
      requiredObjectId(
        customer?._id,
        "customer._id"
      );
    const currentBusinessId =
      idText(
        customer?.business
      );

    let businessAction =
      "reuse";

    if (!currentBusinessId) {
      businessAction =
        scope.safeForGlobalCustomerBackfill
          ? "assign"
          : "blocked";
    } else if (
      currentBusinessId !==
        targetBusinessId
    ) {
      businessAction =
        "conflict";

      blocker(
        blockers,
        {
          resourceType:
            "customer",
          resourceId:
            customerId,
          code:
            "customer-owned-by-other-business",
        }
      );
    }

    customerPlans.push(
      Object.freeze({
        customerId,
        businessAction,
        currentBusinessId:
          currentBusinessId ||
          null,
      })
    );
  }

  for (
    const appointment of
      Array.isArray(
        appointments
      )
        ? appointments
        : []
  ) {
    const appointmentId =
      requiredObjectId(
        appointment?._id,
        "appointment._id"
      );
    const currentBusinessId =
      idText(
        appointment?.business
      );
    const currentLocationId =
      idText(
        appointment?.location
      );
    const customerId =
      idText(
        appointment?.customer
      );
    const serviceId =
      idText(
        appointment?.service
      );
    const stylistId =
      idText(
        appointment?.stylist
      );

    const recordBlockers = [];

    if (
      currentBusinessId &&
      currentBusinessId !==
        targetBusinessId
    ) {
      recordBlockers.push(
        "appointment-owned-by-other-business"
      );
    }

    if (
      currentLocationId &&
      currentLocationId !==
        targetLocationId
    ) {
      recordBlockers.push(
        "appointment-owned-by-other-location"
      );
    }

    const customer =
      customerById.get(
        customerId
      );

    if (!customer) {
      recordBlockers.push(
        "appointment-customer-missing"
      );
    } else {
      const customerBusinessId =
        idText(
          customer.business
        );

      if (
        customerBusinessId &&
        customerBusinessId !==
          targetBusinessId
      ) {
        recordBlockers.push(
          "appointment-customer-business-conflict"
        );
      }

      if (
        !customerBusinessId &&
        !scope.safeForGlobalCustomerBackfill
      ) {
        recordBlockers.push(
          "appointment-customer-business-unproven"
        );
      }
    }

    const service =
      serviceById.get(
        serviceId
      );

    if (!service) {
      recordBlockers.push(
        "appointment-service-missing"
      );
    } else if (
      idText(
        service.business
      ) !==
        targetBusinessId
    ) {
      recordBlockers.push(
        "appointment-service-business-conflict"
      );
    }

    const stylist =
      stylistById.get(
        stylistId
      );

    if (!stylist) {
      recordBlockers.push(
        "appointment-stylist-missing"
      );
    } else if (
      idText(
        stylist.business
      ) !==
        targetBusinessId
    ) {
      recordBlockers.push(
        "appointment-stylist-business-conflict"
      );
    }

    if (
      !currentLocationId &&
      !scope.safeForGlobalAppointmentBackfill
    ) {
      recordBlockers.push(
        "appointment-location-unproven"
      );
    }

    for (
      const code of
        recordBlockers
    ) {
      blocker(
        blockers,
        {
          resourceType:
            "appointment",
          resourceId:
            appointmentId,
          code,
        }
      );
    }

    appointmentPlans.push(
      Object.freeze({
        appointmentId,
        businessAction:
          currentBusinessId ===
            targetBusinessId
            ? "reuse"
            : currentBusinessId
              ? "conflict"
              : (
                  scope.safeForGlobalAppointmentBackfill &&
                  recordBlockers.length ===
                    0
                )
                ? "assign"
                : "blocked",
        locationAction:
          currentLocationId ===
            targetLocationId
            ? "reuse"
            : currentLocationId
              ? "conflict"
              : (
                  scope.safeForGlobalAppointmentBackfill &&
                  recordBlockers.length ===
                    0
                )
                ? "assign"
                : "blocked",
        customerId:
          customerId ||
          null,
        serviceId:
          serviceId ||
          null,
        stylistId:
          stylistId ||
          null,
        blockers:
          Object.freeze([
            ...recordBlockers,
          ]),
      })
    );
  }

  const summary =
    Object.freeze({
      customers:
        customerPlans.length,
      customerBusinessAssignments:
        customerPlans.filter(
          (plan) =>
            plan.businessAction ===
            "assign"
        ).length,
      customerAlreadyOwned:
        customerPlans.filter(
          (plan) =>
            plan.businessAction ===
            "reuse"
        ).length,
      appointments:
        appointmentPlans.length,
      appointmentBusinessAssignments:
        appointmentPlans.filter(
          (plan) =>
            plan.businessAction ===
            "assign"
        ).length,
      appointmentLocationAssignments:
        appointmentPlans.filter(
          (plan) =>
            plan.locationAction ===
            "assign"
        ).length,
      appointmentAlreadyOwned:
        appointmentPlans.filter(
          (plan) =>
            plan.businessAction ===
              "reuse" &&
            plan.locationAction ===
              "reuse"
        ).length,
      blockers:
        blockers.length,
    });

  return Object.freeze({
    businessId:
      targetBusinessId,
    locationId:
      targetLocationId,
    scope,
    safeForBackfill:
      blockers.length ===
        0,
    summary,
    customerPlans:
      Object.freeze(
        customerPlans
      ),
    appointmentPlans:
      Object.freeze(
        appointmentPlans
      ),
    blockers:
      Object.freeze(
        blockers
      ),
  });
}

export function buildCustomerAppointmentBackfillPlan(
  readiness
) {
  if (
    !readiness ||
    typeof readiness !==
      "object"
  ) {
    throw ownershipError(
      "Customer/Appointment readiness is required."
    );
  }

  if (
    readiness.safeForBackfill !==
      true
  ) {
    return Object.freeze({
      dryRun:
        true,
      writesPerformed:
        false,
      executable:
        false,
      blocked:
        true,
      summary:
        Object.freeze({
          customerUpdates:
            0,
          appointmentUpdates:
            0,
          rollbackCustomerRestores:
            0,
          rollbackAppointmentRestores:
            0,
          blockers:
            Array.isArray(
              readiness.blockers
            )
              ? readiness.blockers.length
              : 1,
        }),
      operations:
        Object.freeze([]),
      rollback:
        Object.freeze([]),
    });
  }

  const operations = [];
  const rollback = [];

  for (
    const plan of
      readiness.customerPlans ||
      []
  ) {
    if (
      plan.businessAction !==
        "assign"
    ) {
      continue;
    }

    operations.push(
      Object.freeze({
        type:
          "customer-update",
        customerId:
          plan.customerId,
        set:
          Object.freeze({
            business:
              readiness.businessId,
          }),
      })
    );

    rollback.push(
      Object.freeze({
        type:
          "customer-restore",
        customerId:
          plan.customerId,
        previousBusinessId:
          null,
      })
    );
  }

  for (
    const plan of
      readiness.appointmentPlans ||
      []
  ) {
    if (
      plan.businessAction !==
        "assign" &&
      plan.locationAction !==
        "assign"
    ) {
      continue;
    }

    const set = {};

    if (
      plan.businessAction ===
        "assign"
    ) {
      set.business =
        readiness.businessId;
    }

    if (
      plan.locationAction ===
        "assign"
    ) {
      set.location =
        readiness.locationId;
    }

    operations.push(
      Object.freeze({
        type:
          "appointment-update",
        appointmentId:
          plan.appointmentId,
        set:
          Object.freeze(
            set
          ),
      })
    );

    rollback.push(
      Object.freeze({
        type:
          "appointment-restore",
        appointmentId:
          plan.appointmentId,
        previousBusinessId:
          null,
        previousLocationId:
          null,
      })
    );
  }

  return Object.freeze({
    dryRun:
      true,
    writesPerformed:
      false,
    executable:
      true,
    blocked:
      false,
    summary:
      Object.freeze({
        customerUpdates:
          operations.filter(
            (operation) =>
              operation.type ===
              "customer-update"
          ).length,
        appointmentUpdates:
          operations.filter(
            (operation) =>
              operation.type ===
              "appointment-update"
          ).length,
        rollbackCustomerRestores:
          rollback.filter(
            (operation) =>
              operation.type ===
              "customer-restore"
          ).length,
        rollbackAppointmentRestores:
          rollback.filter(
            (operation) =>
              operation.type ===
              "appointment-restore"
          ).length,
        blockers:
          0,
      }),
    operations:
      Object.freeze(
        operations
      ),
    rollback:
      Object.freeze(
        rollback
      ),
  });
}

export default {
  buildCustomerAppointmentMigrationScope,
  buildCustomerAppointmentOwnershipReadiness,
  buildCustomerAppointmentBackfillPlan,
};
