import "dotenv/config";

import mongoose from "mongoose";
import {
  pathToFileURL,
} from "node:url";

import Service from "../src/models/service.js";
import {
  assertExplicitCanonicalTenantIdentity,
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  loadServiceBackfillSnapshot,
} from "./planServiceTenantBackfill.js";

const APPLY_CONFIRMATION =
  "APPLY_SERVICE_TENANT_BACKFILL";

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
      "MONGODB_URI is required for Service tenant backfill."
    );
  }

  return uri;
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

export function assertServiceApplyAuthorization({
  args = process.argv.slice(2),
  environment = process.env,
  actualFingerprint,
} = {}) {
  if (
    !Array.isArray(args) ||
    !args.includes("--apply")
  ) {
    throw new Error(
      "Service tenant backfill requires the explicit --apply flag."
    );
  }

  if (
    String(
      environment.SERVICE_TENANT_BACKFILL_CONFIRM ||
        ""
    ).trim() !==
      APPLY_CONFIRMATION
  ) {
    throw new Error(
      `Service tenant backfill requires SERVICE_TENANT_BACKFILL_CONFIRM=${APPLY_CONFIRMATION}.`
    );
  }

  const suppliedFingerprint =
    String(
      environment.SERVICE_TENANT_BACKFILL_PLAN_FINGERPRINT ||
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
      "SERVICE_TENANT_BACKFILL_PLAN_FINGERPRINT must contain the reviewed 64-character SHA-256 dry-run fingerprint."
    );
  }

  if (
    suppliedFingerprint !==
      expectedFingerprint
  ) {
    throw new Error(
      "The reviewed Service backfill fingerprint does not match the current database plan. Re-run the dry-run plan and review the new evidence."
    );
  }

  assertExplicitCanonicalTenantIdentity(
    environment
  );

  return true;
}

export function assertServiceApplyPlan(
  plan
) {
  if (
    !plan ||
    plan.executable !==
      true ||
    plan.blocked ===
      true
  ) {
    throw new Error(
      "Only an executable, blocker-free reviewed Service plan may be applied."
    );
  }

  if (
    Number(
      plan?.summary
        ?.offeringsCreated ||
        0
    ) !==
      0
  ) {
    throw new Error(
      "Service tenant backfill must not create LocationServiceOffering records."
    );
  }

  for (
    const operation of
      Array.isArray(
        plan.operations
      )
        ? plan.operations
        : []
  ) {
    if (
      operation?.type !==
        "service-business-assign"
    ) {
      throw new Error(
        `Unsupported Service backfill operation type: ${operation?.type || "unknown"}.`
      );
    }

    if (
      !idText(
        operation.serviceId
      ) ||
      !idText(
        operation.businessId
      )
    ) {
      throw new Error(
        "Service backfill operations require Service and Business identifiers."
      );
    }

    if (
      idText(
        operation.expectedPreviousBusinessId
      )
    ) {
      throw new Error(
        "Service backfill may only assign currently unowned Service records."
      );
    }
  }

  return true;
}

export async function applyServiceBusinessPlan({
  plan,
  session,
}) {
  assertServiceApplyPlan(
    plan
  );

  if (!session) {
    throw new Error(
      "Service tenant backfill requires a MongoDB transaction session."
    );
  }

  const rollbackEvidence = [];

  for (
    const operation of
      plan.operations
  ) {
    const before =
      await Service.findById(
        operation.serviceId
      )
        .session(
          session
        )
        .select(
          "_id business"
        )
        .lean();

    if (!before) {
      throw new Error(
        "Service changed after plan review. Transaction aborted."
      );
    }

    if (
      idText(
        before.business
      ) !==
        idText(
          operation.expectedPreviousBusinessId
        )
    ) {
      throw new Error(
        "Service Business ownership changed after plan review. Transaction aborted."
      );
    }

    const result =
      await Service.updateOne(
        {
          _id:
            operation.serviceId,
          $or: [
            {
              business: {
                $exists:
                  false,
              },
            },
            {
              business:
                null,
            },
          ],
        },
        {
          $set: {
            business:
              operation.businessId,
          },
        },
        {
          session,
        }
      );

    if (
      result.matchedCount !==
        1 ||
      result.modifiedCount !==
        1
    ) {
      throw new Error(
        "Service Business ownership update precondition failed."
      );
    }

    rollbackEvidence.push({
      id:
        String(
          operation.serviceId
        ),
      previousBusinessId:
        operation.expectedPreviousBusinessId ||
        null,
      assignedBusinessId:
        String(
          operation.businessId
        ),
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
    await loadServiceBackfillSnapshot({
      configuration,
    });

  if (
    preflight.report.executable !==
      true
  ) {
    throw new Error(
      "Current Service tenant backfill plan is blocked. Resolve readiness blockers before apply."
    );
  }

  assertServiceApplyPlan(
    preflight.plan
  );

  assertServiceApplyAuthorization({
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
          await loadServiceBackfillSnapshot({
            configuration,
            session,
          });

        if (
          current.report.planFingerprint !==
            preflight.report.planFingerprint
        ) {
          throw new Error(
            "Service catalogue ownership state changed after authorization. Transaction aborted; review a new dry-run fingerprint."
          );
        }

        assertServiceApplyPlan(
          current.plan
        );

        rollbackEvidence =
          await applyServiceBusinessPlan({
            plan:
              current.plan,
            session,
          });

        transactionVerification =
          await loadServiceBackfillSnapshot({
            configuration,
            session,
          });

        if (
          transactionVerification.report.executable !==
            true ||
          transactionVerification.plan.operations.length !==
            0 ||
          Number(
            transactionVerification.report
              ?.planned
              ?.offeringsCreated ||
              0
          ) !==
            0
        ) {
          throw new Error(
            "Service tenant backfill verification did not converge to zero remaining Service ownership operations. Transaction aborted."
          );
        }
      }
    );
  } finally {
    await session.endSession();
  }

  const postflight =
    await loadServiceBackfillSnapshot({
      configuration,
    });

  console.log(
    JSON.stringify(
      {
        applied:
          true,
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
        remainingPlannedOperations: {
          services:
            postflight.plan.operations.length,
          offeringsCreated:
            Number(
              postflight.report
                ?.planned
                ?.offeringsCreated ||
                0
            ),
        },
        rollbackEvidence: {
          services:
            rollbackEvidence ||
            [],
        },
        offeringsCreatedByMigration:
          false,
        indexCutoverPerformed:
          false,
        requiredOwnershipActivated:
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
          "[FAIL] Service tenant backfill apply:",
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
