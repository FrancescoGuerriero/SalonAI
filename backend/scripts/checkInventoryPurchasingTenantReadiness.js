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

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required for inventory/purchasing tenant readiness.");
  }
  return uri;
}

export function assertInventoryPurchasingReadOnlyArguments(args = process.argv.slice(2)) {
  const prohibited = ["--apply", "--write", "--migrate", "--backfill", "--fix"];
  const supplied = (Array.isArray(args) ? args : []).filter((argument) => {
    const value = String(argument || "").trim();
    return prohibited.some(
      (prefix) => value === prefix || value.startsWith(`${prefix}=`)
    );
  });
  if (supplied.length) {
    throw new Error(
      `Inventory/purchasing tenant readiness is read-only. Unsupported write arguments: ${supplied.join(", ")}.`
    );
  }
  return true;
}

function indexNames(indexes = []) {
  return indexes.map((index) => String(index?.name || "")).filter(Boolean).sort();
}

export function sanitiseInventoryPurchasingReadiness(snapshot) {
  const plan = snapshot?.plan || {};
  const productIndexes = indexNames(snapshot?.indexes?.products || []);
  const supplierIndexes = indexNames(snapshot?.indexes?.suppliers || []);
  const purchaseOrderIndexes = indexNames(snapshot?.indexes?.purchaseOrders || []);
  const legacyGlobalUniqueIndexes = Object.freeze({
    productSlug: productIndexes.includes("slug_1"),
    productSku: productIndexes.includes("sku_1"),
    supplierCode: supplierIndexes.includes("code_1"),
    purchaseOrderNumber: purchaseOrderIndexes.includes("orderNumber_1"),
  });

  return Object.freeze({
    ...sanitiseInventoryPurchasingPlan(plan),
    planFingerprint: calculateInventoryPurchasingPlanFingerprint(plan),
    legacyGlobalUniqueIndexes,
    targetTenantIndexesDeclared: Object.freeze({
      productSlug: true,
      productSku: true,
      supplierCode: true,
      purchaseOrderNumber: true,
    }),
    indexCutoverRequired: Object.values(legacyGlobalUniqueIndexes).some(Boolean),
  });
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  assertInventoryPurchasingReadOnlyArguments(args);
  const configuration = getCanonicalSalonTenantConfiguration(environment);
  await mongoose.connect(mongoUri(environment), { serverSelectionTimeoutMS: 15000 });

  const snapshot = await loadInventoryPurchasingOwnershipSnapshot({
    configuration,
    includeIndexes: true,
  });
  const report = sanitiseInventoryPurchasingReadiness(snapshot);
  console.log(JSON.stringify(report, null, 2));

  if (!snapshot.plan.executable) process.exitCode = 2;
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] Inventory/purchasing tenant readiness:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
