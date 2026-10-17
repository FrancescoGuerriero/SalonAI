import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import {
  planCustomerUserAccountIndexMigration,
} from "../src/platform/data/customerUserAccountIndexMigration.js";
import {
  assertCustomerUserAccountIndexReadOnlyArguments,
  loadCustomerUserAccountIndexState,
} from "./checkCustomerUserAccountIndexReadiness.js";

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI || environment.MONGO_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for Customer userAccount index planning."
    );
  }

  return uri;
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  assertCustomerUserAccountIndexReadOnlyArguments(args);

  await mongoose.connect(mongoUri(environment), {
    serverSelectionTimeoutMS: 15000,
  });

  const state = await loadCustomerUserAccountIndexState();
  const plan = planCustomerUserAccountIndexMigration(state);

  console.log(
    JSON.stringify(
      {
        readOnly: true,
        safeForMigration: plan.readiness.safeForMigration,
        alreadyMigrated: plan.readiness.alreadyMigrated,
        summary: plan.readiness.summary,
        operationCount: plan.operationCount,
        fingerprint: plan.fingerprint,
        customerIdentifiersIncluded: false,
        writesPerformed: false,
      },
      null,
      2
    )
  );

  if (!plan.readiness.safeForMigration) {
    process.exitCode = 2;
  }
}

const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error(
        "[FAIL] Customer userAccount index migration plan:",
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
