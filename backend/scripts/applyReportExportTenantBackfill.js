import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import CustomerContactLog from "../src/models/customerContactLog.js";
import Campaign from "../src/features/campaigns/Campaign.js";
import RebookingCampaign from "../src/features/rebookingCampaigns/RebookingCampaign.js";
import InventoryItem from "../src/features/inventory/InventoryItem.js";
import CustomerFeedback from "../src/features/feedbackAnalytics/CustomerFeedback.js";
import FutureAuditEvent from "../src/features/dataExportAudit/FutureAuditEvent.js";
import {
  buildReportExportOwnershipBackfillPlan,
  calculateReportExportBackfillFingerprint,
  sanitiseReportExportBackfillPlan,
} from "../src/platform/tenancy/reportExportOwnershipMigration.js";
import {
  loadReportExportOwnershipMigrationSnapshot,
} from "../src/platform/tenancy/reportExportOwnershipSnapshot.js";

const CONFIRMATION = "APPLY_REPORT_EXPORT_TENANT_BACKFILL";
const MODEL_BY_SOURCE = Object.freeze({
  customerContactLogs: CustomerContactLog,
  campaigns: Campaign,
  rebookingCampaigns: RebookingCampaign,
  inventoryItems: InventoryItem,
  customerFeedback: CustomerFeedback,
  exportAuditEvents: FutureAuditEvent,
});

function applyError(message, code = "REPORT_EXPORT_TENANT_BACKFILL_REJECTED") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) throw applyError("MONGODB_URI is required for report/export tenant backfill.");
  return uri;
}

function fingerprintFrom(args = [], environment = process.env) {
  const cli = (Array.isArray(args) ? args : [])
    .map(String)
    .find((argument) => argument.startsWith("--fingerprint="));
  return String(
    cli?.slice("--fingerprint=".length) ||
      environment.REPORT_EXPORT_TENANT_BACKFILL_FINGERPRINT ||
      ""
  ).trim();
}

export function assertReportExportApplyGate(args = [], environment = process.env) {
  const values = Array.isArray(args) ? args.map(String) : [];
  if (!values.includes("--apply")) {
    throw applyError("Report/export tenant backfill requires the explicit --apply flag.");
  }

  if (String(environment.REPORT_EXPORT_TENANT_BACKFILL_CONFIRM || "").trim() !== CONFIRMATION) {
    throw applyError(
      `Set REPORT_EXPORT_TENANT_BACKFILL_CONFIRM=${CONFIRMATION} before applying.`
    );
  }

  const fingerprint = fingerprintFrom(values, environment);
  if (!/^[a-f0-9]{64}$/i.test(fingerprint)) {
    throw applyError("An exact reviewed SHA-256 report/export backfill fingerprint is required.");
  }

  return Object.freeze({ fingerprint: fingerprint.toLowerCase() });
}

function expectedFieldClause(field, value) {
  if (value) return { [field]: value };
  return { $or: [{ [field]: { $exists: false } }, { [field]: null }] };
}

function operationFilter(operation) {
  const clauses = [{ _id: operation.recordId }];
  clauses.push(expectedFieldClause("business", operation.expected?.business || null));

  if (Object.prototype.hasOwnProperty.call(operation.expected || {}, "location")) {
    clauses.push(expectedFieldClause("location", operation.expected.location || null));
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

async function executeOperation(operation, session) {
  const Model = MODEL_BY_SOURCE[operation.source];
  if (!Model) throw applyError(`Unsupported report/export migration source: ${operation.source}`);

  const result = await Model.updateOne(
    operationFilter(operation),
    { $set: { ...operation.set } },
    { session }
  );

  if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
    throw applyError(
      `Report/export migration precondition changed for ${operation.source}; aborting transaction.`,
      "REPORT_EXPORT_TENANT_BACKFILL_PRECONDITION_CHANGED"
    );
  }
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const gate = assertReportExportApplyGate(args, environment);
  await mongoose.connect(mongoUri(environment), { serverSelectionTimeoutMS: 15000 });

  const session = await mongoose.startSession();
  let appliedCount = 0;
  let reviewedReport = null;

  try {
    await session.withTransaction(async () => {
      const snapshot = await loadReportExportOwnershipMigrationSnapshot({ session });
      const plan = buildReportExportOwnershipBackfillPlan(snapshot);
      const fingerprint = calculateReportExportBackfillFingerprint(plan);
      reviewedReport = sanitiseReportExportBackfillPlan(plan);

      if (!plan.executable) {
        throw applyError(
          "Report/export ownership plan contains blockers; review the zero-write plan before applying."
        );
      }
      if (fingerprint !== gate.fingerprint) {
        throw applyError(
          "The live report/export ownership plan no longer matches the reviewed fingerprint.",
          "REPORT_EXPORT_TENANT_BACKFILL_FINGERPRINT_CHANGED"
        );
      }

      for (const operation of plan.operations) {
        await executeOperation(operation, session);
        appliedCount += 1;
      }

      const postSnapshot = await loadReportExportOwnershipMigrationSnapshot({ session });
      const postPlan = buildReportExportOwnershipBackfillPlan(postSnapshot);
      if (
        postPlan.blocked ||
        postPlan.summary.blockerCount !== 0 ||
        postPlan.summary.operationCount !== 0
      ) {
        throw applyError(
          "Report/export tenant backfill postflight did not converge to zero unresolved ownership operations.",
          "REPORT_EXPORT_TENANT_BACKFILL_POSTFLIGHT_FAILED"
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const output = {
    applied: true,
    writesPerformed: appliedCount > 0,
    piiIncluded: false,
    identifiersIncluded: false,
    planFingerprint: gate.fingerprint,
    appliedOperations: appliedCount,
    reviewed: reviewedReport
      ? {
          businessCount: reviewedReport.businessCount,
          summary: reviewedReport.summary,
          operationCounts: reviewedReport.operationCounts,
        }
      : null,
    postflight: {
      blockers: 0,
      remainingOperations: 0,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] Report/export tenant backfill:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
