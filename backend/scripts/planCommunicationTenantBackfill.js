import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  loadCommunicationOwnershipSnapshot,
} from "../src/platform/tenancy/communicationOwnershipSnapshot.js";
import {
  calculateCommunicationOwnershipPlanFingerprint,
  sanitiseCommunicationOwnershipPlan,
} from "../src/platform/tenancy/communicationOwnershipMigration.js";
import {
  assertCommunicationReadOnlyArguments,
} from "./checkCommunicationTenantReadiness.js";

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) throw new Error("MONGODB_URI is required for communications backfill planning.");
  return uri;
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  assertCommunicationReadOnlyArguments(args);
  const configuration = getCanonicalSalonTenantConfiguration(environment);
  await mongoose.connect(mongoUri(environment), { serverSelectionTimeoutMS: 15000 });

  const snapshot = await loadCommunicationOwnershipSnapshot({ configuration });
  const fingerprint = calculateCommunicationOwnershipPlanFingerprint(snapshot.plan);
  const report = {
    ...sanitiseCommunicationOwnershipPlan(snapshot.plan),
    planFingerprint: fingerprint,
    rollback: {
      strategy:
        "unset only Business/Location ownership fields assigned by this exact reviewed migration after explicit rollback authorisation",
      operationCount: snapshot.plan.operations.length,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!snapshot.plan.executable) process.exitCode = 2;
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] Communications tenant backfill plan:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
