import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  loadInventoryPurchasingOwnershipSnapshot,
} from "../src/platform/tenancy/inventoryPurchasingOwnershipSnapshot.js";
import {
  calculateInventoryPurchasingPlanFingerprint,
  sanitiseInventoryPurchasingPlan,
} from "../src/platform/tenancy/inventoryPurchasingOwnershipMigration.js";
import {
  assertInventoryPurchasingReadOnlyArguments,
} from "./checkInventoryPurchasingTenantReadiness.js";

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) throw new Error("MONGODB_URI is required for inventory/purchasing backfill planning.");
  return uri;
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  assertInventoryPurchasingReadOnlyArguments(args);
  const configuration = getCanonicalSalonTenantConfiguration(environment);
  await mongoose.connect(mongoUri(environment), { serverSelectionTimeoutMS: 15000 });

  const snapshot = await loadInventoryPurchasingOwnershipSnapshot({ configuration });
  const fingerprint = calculateInventoryPurchasingPlanFingerprint(snapshot.plan);
  const report = {
    ...sanitiseInventoryPurchasingPlan(snapshot.plan),
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
      console.error("[FAIL] Inventory/purchasing tenant backfill plan:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
