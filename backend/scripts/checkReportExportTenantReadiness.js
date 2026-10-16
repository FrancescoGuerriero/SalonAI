import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Appointment from "../src/models/Appointment.js";
import Customer from "../src/models/customer.js";
import CustomerContactLog from "../src/models/customerContactLog.js";
import Campaign from "../src/features/campaigns/Campaign.js";
import RebookingCampaign from "../src/features/rebookingCampaigns/RebookingCampaign.js";
import InventoryItem from "../src/features/inventory/InventoryItem.js";
import CustomerFeedback from "../src/features/feedbackAnalytics/CustomerFeedback.js";
import FutureAuditEvent from "../src/features/dataExportAudit/FutureAuditEvent.js";
import { buildReportExportOwnershipReadiness } from "../src/platform/tenancy/reportExportOwnershipReadiness.js";

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required for report/export tenant readiness.");
  }
  return uri;
}

export function assertReportExportReadOnlyArguments(args = process.argv.slice(2)) {
  const prohibitedPrefixes = ["--apply", "--write", "--migrate", "--fix", "--backfill"];
  const supplied = (Array.isArray(args) ? args : []).filter((argument) => {
    const value = String(argument || "").trim();
    return prohibitedPrefixes.some(
      (prefix) => value === prefix || value.startsWith(`${prefix}=`)
    );
  });

  if (supplied.length > 0) {
    throw new Error(
      `Report/export tenant readiness is read-only. Unsupported write arguments: ${supplied.join(", ")}.`
    );
  }
  return true;
}

const missingBusiness = {
  $or: [{ business: { $exists: false } }, { business: null }],
};
const missingLocation = {
  $or: [{ location: { $exists: false } }, { location: null }],
};

async function sourceCounts(Model, { requireLocation = false } = {}) {
  const [total, unownedBusiness, missingRequiredLocation] = await Promise.all([
    Model.countDocuments({}),
    Model.countDocuments(missingBusiness),
    requireLocation ? Model.countDocuments(missingLocation) : Promise.resolve(0),
  ]);

  return {
    total,
    unownedBusiness,
    missingLocation: missingRequiredLocation,
  };
}

export async function loadReportExportOwnershipState() {
  const [
    customers,
    appointments,
    customerContactLogs,
    campaigns,
    rebookingCampaigns,
    inventoryItems,
    customerFeedback,
    exportAuditEvents,
  ] = await Promise.all([
    sourceCounts(Customer),
    sourceCounts(Appointment, { requireLocation: true }),
    sourceCounts(CustomerContactLog),
    sourceCounts(Campaign),
    sourceCounts(RebookingCampaign),
    sourceCounts(InventoryItem),
    sourceCounts(CustomerFeedback),
    sourceCounts(FutureAuditEvent),
  ]);

  return {
    customers,
    appointments,
    customerContactLogs,
    campaigns,
    rebookingCampaigns,
    inventoryItems,
    customerFeedback,
    exportAuditEvents,
  };
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  assertReportExportReadOnlyArguments(args);
  await mongoose.connect(mongoUri(environment), { serverSelectionTimeoutMS: 15000 });

  const readiness = buildReportExportOwnershipReadiness(
    await loadReportExportOwnershipState()
  );

  console.log(JSON.stringify(readiness, null, 2));
  if (!readiness.safeForScopedRuntime) {
    process.exitCode = 2;
  }
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] Report/export tenant readiness:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
