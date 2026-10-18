import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import AuditLog from "../src/models/AuditLog.js";
import Business from "../src/models/Business.js";
import StaffRole from "../src/models/StaffRole.js";
import {
  assertExplicitCanonicalTenantIdentity,
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  planStaffRoleOwnershipBackfill,
} from "../src/platform/tenancy/staffRoleOwnershipMigration.js";

const APPLY_CONFIRMATION = "APPLY_STAFF_ROLE_TENANT_BACKFILL";

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI || environment.MONGO_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for StaffRole tenant backfill."
    );
  }

  return uri;
}

export function assertStaffRoleApplyAuthorization({
  args = process.argv.slice(2),
  environment = process.env,
  actualFingerprint,
} = {}) {
  if (!Array.isArray(args) || !args.includes("--apply")) {
    throw new Error(
      "StaffRole tenant backfill requires the explicit --apply flag."
    );
  }

  if (
    String(environment.STAFF_ROLE_TENANT_BACKFILL_CONFIRM || "").trim() !==
    APPLY_CONFIRMATION
  ) {
    throw new Error(
      `StaffRole tenant backfill requires STAFF_ROLE_TENANT_BACKFILL_CONFIRM=${APPLY_CONFIRMATION}.`
    );
  }

  const supplied = String(
    environment.STAFF_ROLE_TENANT_BACKFILL_PLAN_FINGERPRINT || ""
  )
    .trim()
    .toLowerCase();
  const expected = String(actualFingerprint || "")
    .trim()
    .toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(supplied)) {
    throw new Error(
      "STAFF_ROLE_TENANT_BACKFILL_PLAN_FINGERPRINT must contain the reviewed 64-character SHA-256 dry-run fingerprint."
    );
  }

  if (supplied !== expected) {
    throw new Error(
      "The reviewed StaffRole backfill fingerprint does not match the current database plan. Re-run the dry-run plan and review the new evidence."
    );
  }

  assertExplicitCanonicalTenantIdentity(environment);
  return true;
}

async function loadPlan(configuration, session = null) {
  let businessQuery = Business.findOne({
    slug: configuration.business.slug,
  }).select("_id");
  let businessesQuery = Business.find({})
    .sort({ _id: 1 })
    .select("_id");
  let rolesQuery = StaffRole.find({})
    .sort({ _id: 1 })
    .select("_id business key active");

  if (session) {
    businessQuery = businessQuery.session(session);
    businessesQuery = businessesQuery.session(session);
    rolesQuery = rolesQuery.session(session);
  }

  const [business, businesses, staffRoles] = await Promise.all([
    businessQuery.lean(),
    businessesQuery.lean(),
    rolesQuery.lean(),
  ]);

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete canonical tenant bootstrap before StaffRole apply."
    );
  }

  const plan = planStaffRoleOwnershipBackfill({
    businesses,
    staffRoles,
    businessId: business._id,
  });

  return { business, plan };
}

async function writeMigrationAudit({
  session,
  business,
  fingerprint,
  beforeSummary,
  afterSummary,
  appliedCount,
}) {
  await AuditLog.create(
    [
      {
        action: "tenant_migration.staff_role_business_backfill",
        resourceType: "TenantMigration",
        resourceId: fingerprint,
        before: {
          unowned: beforeSummary.unowned,
          targetOwned: beforeSummary.targetOwned,
          foreignOwned: beforeSummary.foreignOwned,
        },
        after: {
          unowned: afterSummary.unowned,
          targetOwned: afterSummary.targetOwned,
          foreignOwned: afterSummary.foreignOwned,
        },
        metadata: {
          schemaVersion: 1,
          targetBusinessId: String(business._id),
          reviewedFingerprint: fingerprint,
          operationCount: appliedCount,
          rollback: {
            strategy:
              "unset business only for StaffRole records assigned by this reviewed migration after explicit rollback authorisation",
            operationCount: appliedCount,
          },
          identifiersIncluded: false,
          permissionsIncluded: false,
        },
      },
    ],
    { session }
  );
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  const configuration = getCanonicalSalonTenantConfiguration(environment);

  await mongoose.connect(mongoUri(environment), {
    serverSelectionTimeoutMS: 15000,
  });

  const preflight = await loadPlan(configuration);

  if (!preflight.plan.readiness.safeForBusinessBackfill) {
    throw new Error(
      "StaffRole ownership readiness is blocked. Resolve blockers before apply."
    );
  }

  assertStaffRoleApplyAuthorization({
    args,
    environment,
    actualFingerprint: preflight.plan.fingerprint,
  });

  const session = await mongoose.startSession();
  let appliedCount = 0;

  try {
    await session.withTransaction(async () => {
      const current = await loadPlan(configuration, session);

      if (current.plan.fingerprint !== preflight.plan.fingerprint) {
        throw new Error(
          "StaffRole ownership state changed after authorization. Transaction aborted; review a new dry-run fingerprint."
        );
      }

      for (const operation of current.plan.operations) {
        const result = await StaffRole.updateOne(
          {
            _id: operation.roleId,
            $or: [
              { business: { $exists: false } },
              { business: null },
            ],
          },
          { $set: { business: operation.businessId } },
          { session }
        );

        if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
          throw new Error(
            "A StaffRole ownership precondition changed during apply. Transaction aborted."
          );
        }

        appliedCount += 1;
      }

      const transactionalPostflight = await loadPlan(configuration, session);

      if (
        !transactionalPostflight.plan.readiness.safeForBusinessBackfill ||
        transactionalPostflight.plan.readiness.summary.unowned !== 0 ||
        transactionalPostflight.plan.readiness.summary.foreignOwned !== 0
      ) {
        throw new Error(
          "StaffRole transactional postflight failed. Transaction aborted before migration provenance was recorded."
        );
      }

      await writeMigrationAudit({
        session,
        business: current.business,
        fingerprint: preflight.plan.fingerprint,
        beforeSummary: preflight.plan.readiness.summary,
        afterSummary: transactionalPostflight.plan.readiness.summary,
        appliedCount,
      });
    });
  } finally {
    await session.endSession();
  }

  const postflight = await loadPlan(configuration);

  if (
    !postflight.plan.readiness.safeForBusinessBackfill ||
    postflight.plan.readiness.summary.unowned !== 0 ||
    postflight.plan.readiness.summary.foreignOwned !== 0
  ) {
    throw new Error(
      "StaffRole postflight verification failed: unowned or conflicting records remain."
    );
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        reviewedFingerprint: preflight.plan.fingerprint,
        appliedCount,
        remainingUnowned: postflight.plan.readiness.summary.unowned,
        targetOwned: postflight.plan.readiness.summary.targetOwned,
        migrationAuditRecorded: true,
        rollback: {
          operationCount: appliedCount,
          strategy:
            "unset business only for StaffRole records assigned by this reviewed migration if rollback is explicitly authorised",
        },
      },
      null,
      2
    )
  );
}

const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] StaffRole tenant backfill:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
