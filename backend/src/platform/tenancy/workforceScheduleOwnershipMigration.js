import mongoose from "mongoose";

function scheduleError(
  message,
  code = "INVALID_WORKFORCE_SCHEDULE_OWNERSHIP_PLAN"
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
  const id = idText(value);

  if (
    !mongoose.Types.ObjectId.isValid(
      id
    )
  ) {
    throw scheduleError(
      `${label} must be a valid ObjectId.`
    );
  }

  return id;
}

function recordOwnershipAction(
  {
    record,
    recordType,
    locationField,
    targetBusinessId,
    targetLocationId,
    setLocationWhenMissing,
  }
) {
  const recordId =
    requiredObjectId(
      record?._id,
      `${recordType}._id`
    );
  const currentBusinessId =
    idText(
      record?.business
    );
  const currentLocationId =
    locationField
      ? idText(
          record?.[
            locationField
          ]
        )
      : "";

  const blockers = [];

  if (
    currentBusinessId &&
    currentBusinessId !==
      targetBusinessId
  ) {
    blockers.push(
      "record-owned-by-other-business"
    );
  }

  if (
    currentLocationId &&
    currentLocationId !==
      targetLocationId
  ) {
    blockers.push(
      "record-owned-by-other-location"
    );
  }

  const set = {};

  if (!currentBusinessId) {
    set.business =
      targetBusinessId;
  }

  if (
    locationField &&
    setLocationWhenMissing &&
    !currentLocationId
  ) {
    set[
      locationField
    ] =
      targetLocationId;
  }

  return {
    recordId,
    blockers,
    set,
    rollback:
      Object.freeze({
        type:
          `${recordType}-restore`,
        recordId,
        previousBusinessId:
          currentBusinessId ||
          null,
        previousLocationId:
          currentLocationId ||
          null,
        locationField:
          locationField ||
          null,
      }),
  };
}

function pushBlockers(
  destination,
  recordType,
  recordId,
  blockers
) {
  for (
    const blocker of
      blockers
  ) {
    destination.push({
      recordType,
      recordId,
      blocker,
    });
  }
}

function countByType(
  operations
) {
  const counts = {};

  for (
    const operation of
      operations
  ) {
    const key =
      String(
        operation?.type ||
          "unknown"
      );

    counts[key] =
      (
        counts[key] ||
        0
      ) + 1;
  }

  return counts;
}

export function buildWorkforceScheduleBackfillPlan({
  workforceReadiness,
  availabilities = [],
  timeOff = [],
  shifts = [],
  attendance = [],
} = {}) {
  if (
    !workforceReadiness ||
    workforceReadiness.safeForBackfill !==
      true
  ) {
    return Object.freeze({
      dryRun: true,
      writesPerformed: false,
      executable: false,
      blocked: true,
      summary:
        Object.freeze({
          operations: 0,
          rollbackOperations: 0,
          blockers:
            Array.isArray(
              workforceReadiness?.blockers
            )
              ? workforceReadiness.blockers.length
              : 1,
        }),
      operationTypes:
        Object.freeze({}),
      operations:
        Object.freeze([]),
      rollback:
        Object.freeze([]),
      blockers:
        Object.freeze([]),
    });
  }

  const businessId =
    requiredObjectId(
      workforceReadiness.businessId,
      "workforceReadiness.businessId"
    );
  const locationId =
    requiredObjectId(
      workforceReadiness.locationId,
      "workforceReadiness.locationId"
    );

  const staffIds =
    new Set(
      (
        Array.isArray(
          workforceReadiness.plans
        )
          ? workforceReadiness.plans
          : []
      ).map(
        (item) =>
          requiredObjectId(
            item.stylistId,
            "workforceReadiness.plans[].stylistId"
          )
      )
    );

  const blockers = [];
  const candidateOperations = [];
  const candidateRollback = [];
  const shiftById =
    new Map();

  function requireKnownStaff(
    recordType,
    recordId,
    staff
  ) {
    const staffId =
      requiredObjectId(
        staff,
        `${recordType}.staff`
      );

    if (
      !staffIds.has(
        staffId
      )
    ) {
      blockers.push({
        recordType,
        recordId,
        blocker:
          "unknown-workforce-staff",
      });
    }

    return staffId;
  }

  function addOwnershipOperation({
    record,
    recordType,
    locationField,
    setLocationWhenMissing,
  }) {
    const ownership =
      recordOwnershipAction({
        record,
        recordType,
        locationField,
        targetBusinessId:
          businessId,
        targetLocationId:
          locationId,
        setLocationWhenMissing,
      });

    pushBlockers(
      blockers,
      recordType,
      ownership.recordId,
      ownership.blockers
    );

    requireKnownStaff(
      recordType,
      ownership.recordId,
      record?.staff
    );

    if (
      Object.keys(
        ownership.set
      ).length >
      0
    ) {
      candidateOperations.push({
        type:
          `${recordType}-update`,
        recordId:
          ownership.recordId,
        set:
          Object.freeze({
            ...ownership.set,
          }),
      });

      candidateRollback.push(
        ownership.rollback
      );
    }

    return ownership;
  }

  for (
    const record of
      Array.isArray(
        availabilities
      )
        ? availabilities
        : []
  ) {
    addOwnershipOperation({
      record,
      recordType:
        "availability",
      locationField:
        "location",
      setLocationWhenMissing:
        true,
    });
  }

  for (
    const record of
      Array.isArray(
        timeOff
      )
        ? timeOff
        : []
  ) {
    addOwnershipOperation({
      record,
      recordType:
        "time-off",
      locationField:
        "location",
      // Existing time-off without a location remains an all-working-location
      // employee block. Do not silently narrow its historical meaning.
      setLocationWhenMissing:
        false,
    });
  }

  for (
    const record of
      Array.isArray(
        shifts
      )
        ? shifts
        : []
  ) {
    const ownership =
      addOwnershipOperation({
        record,
        recordType:
          "shift",
        locationField:
          "locationRef",
        setLocationWhenMissing:
          true,
      });

    const shiftId =
      ownership.recordId;
    const effectiveBusinessId =
      idText(
        record?.business
      ) ||
      businessId;
    const effectiveLocationId =
      idText(
        record?.locationRef
      ) ||
      locationId;

    shiftById.set(
      shiftId,
      Object.freeze({
        shiftId,
        staffId:
          requiredObjectId(
            record?.staff,
            "shift.staff"
          ),
        businessId:
          effectiveBusinessId,
        locationId:
          effectiveLocationId,
      })
    );
  }

  for (
    const record of
      Array.isArray(
        attendance
      )
        ? attendance
        : []
  ) {
    const attendanceId =
      requiredObjectId(
        record?._id,
        "attendance._id"
      );
    const staffId =
      requireKnownStaff(
        "attendance",
        attendanceId,
        record?.staff
      );
    const shiftId =
      requiredObjectId(
        record?.shift,
        "attendance.shift"
      );
    const shift =
      shiftById.get(
        shiftId
      );

    if (!shift) {
      blockers.push({
        recordType:
          "attendance",
        recordId:
          attendanceId,
        blocker:
          "attendance-shift-missing-from-plan",
      });
      continue;
    }

    if (
      shift.staffId !==
        staffId
    ) {
      blockers.push({
        recordType:
          "attendance",
        recordId:
          attendanceId,
        blocker:
          "attendance-staff-shift-mismatch",
      });
    }

    const ownership =
      recordOwnershipAction({
        record,
        recordType:
          "attendance",
        locationField:
          "locationRef",
        targetBusinessId:
          shift.businessId,
        targetLocationId:
          shift.locationId,
        setLocationWhenMissing:
          true,
      });

    pushBlockers(
      blockers,
      "attendance",
      attendanceId,
      ownership.blockers
    );

    if (
      Object.keys(
        ownership.set
      ).length >
      0
    ) {
      candidateOperations.push({
        type:
          "attendance-update",
        recordId:
          attendanceId,
        set:
          Object.freeze({
            ...ownership.set,
          }),
      });

      candidateRollback.push(
        ownership.rollback
      );
    }
  }

  if (
    blockers.length >
      0
  ) {
    return Object.freeze({
      dryRun: true,
      writesPerformed: false,
      executable: false,
      blocked: true,
      businessId,
      locationId,
      summary:
        Object.freeze({
          operations: 0,
          rollbackOperations: 0,
          blockers:
            blockers.length,
        }),
      operationTypes:
        Object.freeze({}),
      operations:
        Object.freeze([]),
      rollback:
        Object.freeze([]),
      blockers:
        Object.freeze(
          blockers.map(
            (item) =>
              Object.freeze({
                ...item,
              })
          )
        ),
    });
  }

  return Object.freeze({
    dryRun: true,
    writesPerformed: false,
    executable: true,
    blocked: false,
    businessId,
    locationId,
    summary:
      Object.freeze({
        operations:
          candidateOperations.length,
        rollbackOperations:
          candidateRollback.length,
        blockers: 0,
      }),
    operationTypes:
      Object.freeze(
        countByType(
          candidateOperations
        )
      ),
    operations:
      Object.freeze(
        candidateOperations.map(
          (item) =>
            Object.freeze({
              ...item,
            })
        )
      ),
    rollback:
      Object.freeze(
        candidateRollback
      ),
    blockers:
      Object.freeze([]),
  });
}

export default {
  buildWorkforceScheduleBackfillPlan,
};
