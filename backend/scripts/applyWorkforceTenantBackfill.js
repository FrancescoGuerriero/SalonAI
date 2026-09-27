import "dotenv/config";

import mongoose from "mongoose";
import {
  pathToFileURL,
} from "node:url";

import Business from "../src/models/Business.js";
import BusinessMembership from "../src/models/BusinessMembership.js";
import Location from "../src/models/Location.js";
import Stylist from "../src/models/Stylist.js";
import User from "../src/models/user.js";
import StaffAvailability from "../src/features/staff/StaffAvailability.js";
import StaffTimeOff from "../src/features/staff/StaffTimeOff.js";
import StaffShift from "../src/features/staffRota/StaffShift.js";
import StaffAttendance from "../src/features/staffRota/StaffAttendance.js";
import {
  assertExplicitCanonicalTenantIdentity,
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  buildWorkforceBackfillPlan,
  buildWorkforceOwnershipReadiness,
} from "../src/platform/tenancy/workforceOwnershipMigration.js";
import {
  buildWorkforceScheduleBackfillPlan,
} from "../src/platform/tenancy/workforceScheduleOwnershipMigration.js";
import {
  sanitiseWorkforceBackfillPlan,
} from "./planWorkforceTenantBackfill.js";

const APPLY_CONFIRMATION =
  "APPLY_WORKFORCE_TENANT_BACKFILL";

function mongoUri(
  environment = process.env
) {
  const uri =
    String(
      environment.MONGODB_URI ||
        environment.MONGO_URI ||
        ""
    ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for workforce tenant backfill."
    );
  }

  return uri;
}

export function assertWorkforceApplyAuthorization({
  args = process.argv.slice(2),
  environment = process.env,
  actualFingerprint,
} = {}) {
  if (
    !Array.isArray(args) ||
    !args.includes("--apply")
  ) {
    throw new Error(
      "Workforce tenant backfill requires the explicit --apply flag."
    );
  }

  if (
    String(
      environment.WORKFORCE_TENANT_BACKFILL_CONFIRM ||
        ""
    ).trim() !==
      APPLY_CONFIRMATION
  ) {
    throw new Error(
      `Workforce tenant backfill requires WORKFORCE_TENANT_BACKFILL_CONFIRM=${APPLY_CONFIRMATION}.`
    );
  }

  const suppliedFingerprint =
    String(
      environment.WORKFORCE_TENANT_BACKFILL_PLAN_FINGERPRINT ||
        ""
    )
      .trim()
      .toLowerCase();

  const expectedFingerprint =
    String(
      actualFingerprint ||
        ""
    )
      .trim()
      .toLowerCase();

  if (
    !/^[a-f0-9]{64}$/.test(
      suppliedFingerprint
    )
  ) {
    throw new Error(
      "WORKFORCE_TENANT_BACKFILL_PLAN_FINGERPRINT must contain the reviewed 64-character SHA-256 dry-run fingerprint."
    );
  }

  if (
    suppliedFingerprint !==
      expectedFingerprint
  ) {
    throw new Error(
      "The reviewed workforce backfill fingerprint does not match the current database plan. Re-run the dry-run plan and review the new evidence."
    );
  }

  assertExplicitCanonicalTenantIdentity(
    environment
  );

  return true;
}

async function resolveCanonicalOwnership(
  configuration,
  session = null
) {
  let businessQuery =
    Business.findOne({
      slug:
        configuration.business.slug,
    })
      .select(
        "_id name slug businessType"
      );

  if (session) {
    businessQuery =
      businessQuery.session(
        session
      );
  }

  const business =
    await businessQuery.lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete the canonical tenant bootstrap before workforce apply."
    );
  }

  let locationQuery =
    Location.findOne({
      business:
        business._id,
      slug:
        configuration.location.slug,
      status:
        "active",
    })
      .select(
        "_id business slug status"
      );

  if (session) {
    locationQuery =
      locationQuery.session(
        session
      );
  }

  const location =
    await locationQuery.lean();

  if (!location) {
    throw new Error(
      "Canonical active primary Location is missing. Complete the canonical tenant bootstrap before workforce apply."
    );
  }

  return {
    business,
    location,
  };
}

async function loadPlans({
  configuration,
  session = null,
}) {
  const {
    business,
    location,
  } =
    await resolveCanonicalOwnership(
      configuration,
      session
    );

  let stylistQuery =
    Stylist.find({})
      .sort({
        _id: 1,
      })
      .select(
        "_id business workingLocations userAccount email isActive acceptsAppointments profilePublished"
      );

  if (session) {
    stylistQuery =
      stylistQuery.session(
        session
      );
  }

  const stylists =
    await stylistQuery.lean();

  const linkedUserIds =
    [
      ...new Set(
        stylists
          .map(
            (stylist) =>
              String(
                stylist.userAccount ||
                  ""
              ).trim()
          )
          .filter(Boolean)
      ),
    ];

  const stylistEmails =
    [
      ...new Set(
        stylists
          .map(
            (stylist) =>
              String(
                stylist.email ||
                  ""
              )
                .trim()
                .toLowerCase()
          )
          .filter(Boolean)
      ),
    ];

  let userQuery =
    User.find({
      $or: [
        {
          _id: {
            $in:
              linkedUserIds,
          },
        },
        {
          email: {
            $in:
              stylistEmails,
          },
        },
      ],
    })
      .sort({
        _id: 1,
      })
      .select(
        "_id email role isActive"
      );

  if (session) {
    userQuery =
      userQuery.session(
        session
      );
  }

  const users =
    await userQuery.lean();

  const userIds =
    users.map(
      (user) =>
        user._id
    );

  let memberships = [];

  if (
    userIds.length >
      0
  ) {
    let membershipQuery =
      BusinessMembership.find({
        user: {
          $in:
            userIds,
        },
      })
        .sort({
          _id: 1,
        })
        .select(
          "_id user business status roleKey locationAccessMode locations"
        );

    if (session) {
      membershipQuery =
        membershipQuery.session(
          session
        );
    }

    memberships =
      await membershipQuery.lean();
  }

  const readiness =
    buildWorkforceOwnershipReadiness({
      stylists,
      users,
      memberships,
      businessId:
        business._id,
      locationId:
        location._id,
    });

  const workforcePlan =
    buildWorkforceBackfillPlan(
      readiness
    );

  function childQuery(
    Model,
    fields
  ) {
    let query =
      Model.find({})
        .sort({
          _id: 1,
        })
        .select(
          fields
        );

    if (session) {
      query =
        query.session(
          session
        );
    }

    return query.lean();
  }

  const [
    availabilities,
    timeOff,
    shifts,
    attendance,
  ] =
    await Promise.all([
      childQuery(
        StaffAvailability,
        "_id business location staff"
      ),
      childQuery(
        StaffTimeOff,
        "_id business location staff"
      ),
      childQuery(
        StaffShift,
        "_id business locationRef location staff"
      ),
      childQuery(
        StaffAttendance,
        "_id business locationRef shift staff"
      ),
    ]);

  const schedulePlan =
    buildWorkforceScheduleBackfillPlan({
      workforceReadiness:
        readiness,
      availabilities,
      timeOff,
      shifts,
      attendance,
    });

  const report =
    sanitiseWorkforceBackfillPlan({
      readiness,
      plan:
        workforcePlan,
      schedulePlan,
    });

  return {
    business,
    location,
    readiness,
    workforcePlan,
    schedulePlan,
    report,
  };
}

function idText(
  value
) {
  return String(
    value || ""
  ).trim();
}

function sortedIds(
  values
) {
  return (
    Array.isArray(values)
      ? values
      : []
  )
    .map(
      (value) =>
        idText(
          value
        )
    )
    .filter(Boolean)
    .sort();
}

function sameIdArray(
  left,
  right
) {
  return (
    JSON.stringify(
      sortedIds(
        left
      )
    ) ===
    JSON.stringify(
      sortedIds(
        right
      )
    )
  );
}

function rollbackForStylist(
  plan,
  stylistId
) {
  return plan.rollback.find(
    (entry) =>
      entry.type ===
        "stylist-restore" &&
      entry.stylistId ===
        stylistId
  );
}

function rollbackForSchedule(
  plan,
  recordId
) {
  return plan.rollback.find(
    (entry) =>
      entry.recordId ===
        recordId
  );
}

async function applyStylistOperation({
  operation,
  plan,
  session,
  rollbackEvidence,
}) {
  const before =
    await Stylist.findById(
      operation.stylistId
    )
      .session(
        session
      )
      .select(
        "_id business workingLocations"
      )
      .lean();

  if (!before) {
    throw new Error(
      `Stylist ${operation.stylistId} disappeared after the reviewed plan was generated.`
    );
  }

  const expected =
    rollbackForStylist(
      plan,
      operation.stylistId
    );

  if (!expected) {
    throw new Error(
      "Missing Stylist rollback precondition metadata."
    );
  }

  if (
    idText(
      before.business
    ) !==
      idText(
        expected.previousBusinessId
      ) ||
    !sameIdArray(
      before.workingLocations,
      expected.previousWorkingLocations
    )
  ) {
    throw new Error(
      "Stylist ownership changed after plan review. Transaction aborted; generate a new dry-run fingerprint."
    );
  }

  const result =
    await Stylist.updateOne(
      {
        _id:
          operation.stylistId,
      },
      operation.update,
      {
        session,
      }
    );

  if (
    result.matchedCount !==
      1
  ) {
    throw new Error(
      "Stylist update precondition failed."
    );
  }

  rollbackEvidence.stylists.push({
    id:
      operation.stylistId,
    previousBusinessId:
      expected.previousBusinessId,
    previousWorkingLocations:
      [
        ...expected.previousWorkingLocations,
      ],
  });
}

async function applyMembershipOperation({
  operation,
  session,
  rollbackEvidence,
}) {
  const existing =
    await BusinessMembership.findOne({
      user:
        operation.userId,
      business:
        operation.businessId,
    })
      .session(
        session
      )
      .select(
        "_id"
      )
      .lean();

  if (existing) {
    throw new Error(
      "BusinessMembership changed after plan review. Transaction aborted; generate a new dry-run fingerprint."
    );
  }

  const created =
    await BusinessMembership.create(
      [{
        user:
          operation.userId,
        business:
          operation.businessId,
        status:
          "active",
        roleKey:
          operation.roleKey,
        locationAccessMode:
          operation.locationAccessMode,
        locations:
          operation.locations,
        isDefault:
          false,
      }],
      {
        session,
      }
    );

  rollbackEvidence.memberships.push({
    id:
      String(
        created[0]._id
      ),
    userId:
      operation.userId,
    businessId:
      operation.businessId,
  });
}

const scheduleModels =
  Object.freeze({
    "availability-update":
      StaffAvailability,
    "time-off-update":
      StaffTimeOff,
    "shift-update":
      StaffShift,
    "attendance-update":
      StaffAttendance,
  });

async function applyScheduleOperation({
  operation,
  plan,
  session,
  rollbackEvidence,
}) {
  const Model =
    scheduleModels[
      operation.type
    ];

  if (!Model) {
    throw new Error(
      `Unsupported schedule operation type: ${operation.type}.`
    );
  }

  const before =
    await Model.findById(
      operation.recordId
    )
      .session(
        session
      )
      .select(
        "_id business location locationRef"
      )
      .lean();

  if (!before) {
    throw new Error(
      `Schedule record ${operation.recordId} disappeared after plan review.`
    );
  }

  const expected =
    rollbackForSchedule(
      plan,
      operation.recordId
    );

  if (!expected) {
    throw new Error(
      "Missing schedule rollback precondition metadata."
    );
  }

  if (
    idText(
      before.business
    ) !==
      idText(
        expected.previousBusinessId
      )
  ) {
    throw new Error(
      "Schedule Business ownership changed after plan review. Transaction aborted."
    );
  }

  if (
    expected.locationField &&
    idText(
      before[
        expected.locationField
      ]
    ) !==
      idText(
        expected.previousLocationId
      )
  ) {
    throw new Error(
      "Schedule Location ownership changed after plan review. Transaction aborted."
    );
  }

  const result =
    await Model.updateOne(
      {
        _id:
          operation.recordId,
      },
      {
        $set:
          operation.set,
      },
      {
        session,
      }
    );

  if (
    result.matchedCount !==
      1
  ) {
    throw new Error(
      "Schedule ownership update precondition failed."
    );
  }

  rollbackEvidence.schedule.push({
    type:
      operation.type,
    id:
      operation.recordId,
    previousBusinessId:
      expected.previousBusinessId,
    previousLocationId:
      expected.previousLocationId,
    locationField:
      expected.locationField,
  });
}

export async function applyWorkforcePlans({
  workforcePlan,
  schedulePlan,
  session,
}) {
  if (
    workforcePlan?.executable !==
      true ||
    schedulePlan?.executable !==
      true
  ) {
    throw new Error(
      "Only executable, blocker-free reviewed plans may be applied."
    );
  }

  const rollbackEvidence = {
    stylists: [],
    memberships: [],
    schedule: [],
  };

  for (
    const operation of
      workforcePlan.operations
  ) {
    if (
      operation.type ===
        "stylist-update"
    ) {
      await applyStylistOperation({
        operation,
        plan:
          workforcePlan,
        session,
        rollbackEvidence,
      });
    } else if (
      operation.type ===
        "membership-create"
    ) {
      await applyMembershipOperation({
        operation,
        session,
        rollbackEvidence,
      });
    } else {
      throw new Error(
        `Unsupported workforce operation type: ${operation.type}.`
      );
    }
  }

  for (
    const operation of
      schedulePlan.operations
  ) {
    await applyScheduleOperation({
      operation,
      plan:
        schedulePlan,
      session,
      rollbackEvidence,
    });
  }

  return rollbackEvidence;
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  const configuration =
    getCanonicalSalonTenantConfiguration(
      environment
    );

  await mongoose.connect(
    mongoUri(
      environment
    ),
    {
      serverSelectionTimeoutMS:
        15000,
    }
  );

  const preflight =
    await loadPlans({
      configuration,
    });

  if (
    !preflight.report.executable
  ) {
    throw new Error(
      "Current workforce backfill plan is blocked. Resolve readiness blockers before apply."
    );
  }

  assertWorkforceApplyAuthorization({
    args,
    environment,
    actualFingerprint:
      preflight.report.planFingerprint,
  });

  const session =
    await mongoose.startSession();

  let rollbackEvidence =
    null;
  let transactionVerification =
    null;

  try {
    await session.withTransaction(
      async () => {
        const current =
          await loadPlans({
            configuration,
            session,
          });

        if (
          current.report.planFingerprint !==
            preflight.report.planFingerprint
        ) {
          throw new Error(
            "Workforce ownership state changed after authorization. Transaction aborted; review a new dry-run fingerprint."
          );
        }

        rollbackEvidence =
          await applyWorkforcePlans({
            workforcePlan:
              current.workforcePlan,
            schedulePlan:
              current.schedulePlan,
            session,
          });

        transactionVerification =
          await loadPlans({
            configuration,
            session,
          });

        const remainingWorkforceOperations =
          transactionVerification.workforcePlan
            .operations.length;
        const remainingScheduleOperations =
          transactionVerification.schedulePlan
            .operations.length;

        if (
          transactionVerification.report.executable !==
            true ||
          remainingWorkforceOperations !==
            0 ||
          remainingScheduleOperations !==
            0
        ) {
          throw new Error(
            "Workforce backfill verification did not converge to zero remaining operations. Transaction aborted."
          );
        }
      }
    );
  } finally {
    await session.endSession();
  }

  const postflight =
    await loadPlans({
      configuration,
    });

  console.log(
    JSON.stringify(
      {
        applied: true,
        transactionCommitted:
          true,
        verifiedInsideTransaction:
          Boolean(
            transactionVerification
          ),
        reviewedPlanFingerprint:
          preflight.report.planFingerprint,
        postflightExecutable:
          postflight.report.executable,
        remainingPlannedOperations:
          {
            workforce:
              postflight.report.planned.workforce
                .stylistUpdates +
              postflight.report.planned.workforce
                .membershipCreates,
            scheduleAndRota:
              postflight.report.planned.scheduleAndRota
                .operations,
          },
        rollbackEvidence,
        indexCutoverPerformed:
          false,
        routeEnforcementPerformed:
          false,
      },
      null,
      2
    )
  );
}

const executedDirectly =
  Boolean(
    process.argv[1]
  ) &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1]
    ).href;

if (executedDirectly) {
  main()
    .catch(
      (error) => {
        console.error(
          "[FAIL] Workforce tenant backfill apply:",
          error.message
        );
        process.exitCode =
          1;
      }
    )
    .finally(
      async () => {
        await mongoose
          .disconnect()
          .catch(
            () => {}
          );
      }
    );
}
