import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Customer from "../src/models/customer.js";
import {
  LEGACY_CUSTOMER_USER_ACCOUNT_INDEX,
  TARGET_CUSTOMER_USER_ACCOUNT_INDEX,
  TARGET_CUSTOMER_USER_ACCOUNT_INDEX_SPEC,
  buildCustomerUserAccountIndexReadiness,
  planCustomerUserAccountIndexMigration,
} from "../src/platform/data/customerUserAccountIndexMigration.js";
import {
  loadCustomerUserAccountIndexState,
} from "./checkCustomerUserAccountIndexReadiness.js";

const APPLY_CONFIRMATION =
  "APPLY_CUSTOMER_USER_ACCOUNT_PARTIAL_INDEX";

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI || environment.MONGO_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for Customer userAccount index migration."
    );
  }

  return uri;
}

export function assertCustomerUserAccountIndexApplyAuthorization({
  args = process.argv.slice(2),
  environment = process.env,
  actualFingerprint,
} = {}) {
  if (!Array.isArray(args) || !args.includes("--apply")) {
    throw new Error(
      "Customer userAccount index migration requires the explicit --apply flag."
    );
  }

  if (
    String(
      environment.CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_CONFIRM || ""
    ).trim() !== APPLY_CONFIRMATION
  ) {
    throw new Error(
      `Customer userAccount index migration requires CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_CONFIRM=${APPLY_CONFIRMATION}.`
    );
  }

  const supplied = String(
    environment.CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_PLAN_FINGERPRINT ||
      ""
  )
    .trim()
    .toLowerCase();
  const expected = String(actualFingerprint || "")
    .trim()
    .toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(supplied)) {
    throw new Error(
      "CUSTOMER_USER_ACCOUNT_INDEX_MIGRATION_PLAN_FINGERPRINT must contain the reviewed 64-character SHA-256 dry-run fingerprint."
    );
  }

  if (supplied !== expected) {
    throw new Error(
      "The reviewed Customer userAccount index fingerprint does not match the current database plan. Re-run readiness and the zero-write plan."
    );
  }

  return true;
}

async function currentPlan() {
  const state = await loadCustomerUserAccountIndexState();
  return planCustomerUserAccountIndexMigration(state);
}

async function ensureTargetIndex() {
  const state = await loadCustomerUserAccountIndexState();
  const readiness = buildCustomerUserAccountIndexReadiness(state);

  if (readiness.summary.targetIndexPresent) {
    return false;
  }

  await Customer.collection.createIndex(
    TARGET_CUSTOMER_USER_ACCOUNT_INDEX_SPEC.key,
    TARGET_CUSTOMER_USER_ACCOUNT_INDEX_SPEC.options
  );

  const verified = buildCustomerUserAccountIndexReadiness(
    await loadCustomerUserAccountIndexState()
  );

  if (!verified.summary.targetIndexPresent) {
    throw new Error(
      "Target Customer userAccount partial unique index was not visible after creation. Legacy index has not been removed."
    );
  }

  return true;
}

async function dropLegacyIndexIfPresent() {
  const state = await loadCustomerUserAccountIndexState();
  const readiness = buildCustomerUserAccountIndexReadiness(state);

  if (!readiness.summary.legacyIndexPresent) {
    return false;
  }

  if (!readiness.summary.targetIndexPresent) {
    throw new Error(
      "Refusing to drop legacy Customer userAccount index before the target partial unique index is verified."
    );
  }

  await Customer.collection.dropIndex(
    LEGACY_CUSTOMER_USER_ACCOUNT_INDEX
  );

  return true;
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  await mongoose.connect(mongoUri(environment), {
    serverSelectionTimeoutMS: 15000,
  });

  const preflight = await currentPlan();

  if (!preflight.readiness.safeForMigration) {
    throw new Error(
      "Customer userAccount index migration readiness is blocked. Resolve duplicate or unexpected-index blockers before apply."
    );
  }

  assertCustomerUserAccountIndexApplyAuthorization({
    args,
    environment,
    actualFingerprint: preflight.fingerprint,
  });

  const rechecked = await currentPlan();

  if (rechecked.fingerprint !== preflight.fingerprint) {
    throw new Error(
      "Customer userAccount index state changed after authorization. No index changes were attempted; review a new dry-run fingerprint."
    );
  }

  if (rechecked.readiness.alreadyMigrated) {
    console.log(
      JSON.stringify(
        {
          applied: false,
          alreadyMigrated: true,
          reviewedFingerprint: preflight.fingerprint,
          targetIndex: TARGET_CUSTOMER_USER_ACCOUNT_INDEX,
          databaseWrites: false,
        },
        null,
        2
      )
    );
    return;
  }

  // MongoDB index DDL is not transactional. The safe ordering is therefore:
  // prove no duplicate linked accounts -> create/verify the replacement index ->
  // only then remove the legacy sparse unique index. There is no uniqueness gap.
  const targetCreated = await ensureTargetIndex();
  const legacyDropped = await dropLegacyIndexIfPresent();

  const postflight = buildCustomerUserAccountIndexReadiness(
    await loadCustomerUserAccountIndexState()
  );

  if (
    !postflight.safeForMigration ||
    !postflight.alreadyMigrated ||
    postflight.summary.duplicateLinkedAccountGroups !== 0
  ) {
    throw new Error(
      "Customer userAccount index postflight failed. Do not treat the migration as complete."
    );
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        reviewedFingerprint: preflight.fingerprint,
        targetIndex: TARGET_CUSTOMER_USER_ACCOUNT_INDEX,
        targetCreated,
        legacyDropped,
        remainingDuplicateLinkedAccountGroups:
          postflight.summary.duplicateLinkedAccountGroups,
        legacyIndexPresent:
          postflight.summary.legacyIndexPresent,
        targetIndexPresent:
          postflight.summary.targetIndexPresent,
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
      console.error(
        "[FAIL] Customer userAccount index migration:",
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
