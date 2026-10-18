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

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) throw new Error("MONGODB_URI is required for communications tenant readiness.");
  return uri;
}

export function assertCommunicationReadOnlyArguments(args = process.argv.slice(2)) {
  const prohibited = ["--apply", "--write", "--migrate", "--backfill", "--fix"];
  const supplied = (Array.isArray(args) ? args : []).filter((argument) => {
    const value = String(argument || "").trim();
    return prohibited.some(
      (prefix) => value === prefix || value.startsWith(`${prefix}=`)
    );
  });
  if (supplied.length) {
    throw new Error(
      `Communications tenant readiness is read-only. Unsupported write arguments: ${supplied.join(", ")}.`
    );
  }
  return true;
}

function indexNames(indexes = []) {
  return indexes.map((index) => String(index?.name || "")).filter(Boolean).sort();
}

export function sanitiseCommunicationReadiness(snapshot) {
  const plan = snapshot?.plan || {};
  const campaignIndexes = indexNames(snapshot?.indexes?.campaigns || []);
  const templateIndexes = indexNames(snapshot?.indexes?.templates || []);
  const legacyGlobalUniqueIndexes = Object.freeze({
    campaignSlug: campaignIndexes.includes("slug_1"),
    templateSlug: templateIndexes.includes("slug_1"),
  });

  return Object.freeze({
    ...sanitiseCommunicationOwnershipPlan(plan),
    planFingerprint: calculateCommunicationOwnershipPlanFingerprint(plan),
    legacyGlobalUniqueIndexes,
    targetTenantIndexesDeclared: Object.freeze({
      campaignSlug: true,
      templateSlug: true,
      campaignRuntimeScope: true,
      templateRuntimeScope: true,
      recipientRuntimeScope: true,
      scheduledRuntimeScope: true,
      messageDeliveryRuntimeScope: true,
    }),
    indexCutoverRequired: Object.values(legacyGlobalUniqueIndexes).some(Boolean),
  });
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  assertCommunicationReadOnlyArguments(args);
  const configuration = getCanonicalSalonTenantConfiguration(environment);
  await mongoose.connect(mongoUri(environment), { serverSelectionTimeoutMS: 15000 });

  const snapshot = await loadCommunicationOwnershipSnapshot({
    configuration,
    includeIndexes: true,
  });
  const report = sanitiseCommunicationReadiness(snapshot);
  console.log(JSON.stringify(report, null, 2));
  if (!snapshot.plan.executable) process.exitCode = 2;
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] Communications tenant readiness:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
