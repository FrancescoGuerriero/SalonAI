import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import {
  buildReportExportOwnershipBackfillPlan,
  sanitiseReportExportBackfillPlan,
} from "../src/platform/tenancy/reportExportOwnershipMigration.js";
import {
  loadReportExportOwnershipMigrationSnapshot,
} from "../src/platform/tenancy/reportExportOwnershipSnapshot.js";

const FORBIDDEN_ARGUMENT_PREFIXES = [
  "--apply",
  "--write",
  "--migrate",
  "--fix",
  "--backfill",
];

export function assertReportExportPlanArguments(args = []) {
  const forbidden = (Array.isArray(args) ? args : []).find((argument) =>
    FORBIDDEN_ARGUMENT_PREFIXES.some((prefix) => String(argument).startsWith(prefix))
  );
  if (forbidden) {
    throw new Error(`Report/export backfill planning is read-only; rejected argument ${forbidden}.`);
  }
}

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) throw new Error("MONGODB_URI is required for report/export backfill planning.");
  return uri;
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  assertReportExportPlanArguments(args);

  await mongoose.connect(mongoUri(environment), { serverSelectionTimeoutMS: 15000 });

  const snapshot = await loadReportExportOwnershipMigrationSnapshot();
  const plan = buildReportExportOwnershipBackfillPlan(snapshot);
  const report = sanitiseReportExportBackfillPlan(plan);

  console.log(JSON.stringify(report, null, 2));
  if (!plan.executable) process.exitCode = 2;
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] Report/export tenant backfill plan:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
