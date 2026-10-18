import assert from "node:assert/strict";
import test from "node:test";

import { buildReportExportOwnershipReadiness } from "../platform/tenancy/reportExportOwnershipReadiness.js";
import { assertReportExportReadOnlyArguments } from "../../scripts/checkReportExportTenantReadiness.js";
import Customer from "../models/customer.js";
import Appointment from "../models/Appointment.js";
import CustomerContactLog from "../models/customerContactLog.js";
import Campaign from "../features/campaigns/Campaign.js";
import RebookingCampaign from "../features/rebookingCampaigns/RebookingCampaign.js";
import InventoryItem from "../features/inventory/InventoryItem.js";
import CustomerFeedback from "../features/feedbackAnalytics/CustomerFeedback.js";
import FutureAuditEvent from "../features/dataExportAudit/FutureAuditEvent.js";

test("report/export readiness fails closed on missing Business and required Appointment location", () => {
  const readiness = buildReportExportOwnershipReadiness({
    customers: { total: 10, unownedBusiness: 2 },
    appointments: { total: 8, unownedBusiness: 0, missingLocation: 1 },
  });

  assert.equal(readiness.readOnly, true);
  assert.equal(readiness.safeForScopedRuntime, false);
  assert.equal(readiness.summary.totalUnownedBusiness, 2);
  assert.equal(readiness.summary.totalMissingRequiredLocation, 1);
  assert.equal(readiness.recordIdentifiersIncluded, false);
  assert.equal(readiness.writesPerformed, false);
});

test("report/export readiness is safe only when every required ownership field is complete", () => {
  const complete = Object.fromEntries(
    ["customers", "appointments", "customerContactLogs", "campaigns", "rebookingCampaigns", "inventoryItems", "customerFeedback", "exportAuditEvents"].map((name) => [name, { total: 1, unownedBusiness: 0, missingLocation: 0 }])
  );

  const readiness = buildReportExportOwnershipReadiness(complete);
  assert.equal(readiness.safeForScopedRuntime, true);
  assert.equal(readiness.summary.blockerCount, 0);
});

test("readiness command rejects write-like arguments", () => {
  assert.equal(assertReportExportReadOnlyArguments([]), true);
  assert.throws(() => assertReportExportReadOnlyArguments(["--apply"]), /read-only/i);
  assert.throws(() => assertReportExportReadOnlyArguments(["--backfill=yes"]), /read-only/i);
});

test("report/export source schemas expose transitional trusted ownership", () => {
  assert.ok(Customer.schema.path("business"));
  assert.ok(Appointment.schema.path("business"));
  assert.ok(Appointment.schema.path("location"));
  assert.ok(CustomerContactLog.schema.path("business"));
  assert.ok(CustomerContactLog.schema.path("location"));
  assert.ok(Campaign.schema.path("business"));
  assert.ok(RebookingCampaign.schema.path("business"));
  assert.ok(InventoryItem.schema.path("business"));
  assert.ok(InventoryItem.schema.path("location"));
  assert.ok(CustomerFeedback.schema.path("business"));
  assert.ok(CustomerFeedback.schema.path("location"));
  assert.ok(FutureAuditEvent.schema.path("business"));
  assert.ok(FutureAuditEvent.schema.path("location"));
  assert.ok(FutureAuditEvent.schema.path("locationScope"));
});
