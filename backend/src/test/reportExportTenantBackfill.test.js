import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  buildReportExportOwnershipBackfillPlan,
  calculateReportExportBackfillFingerprint,
  sanitiseReportExportBackfillPlan,
} from "../platform/tenancy/reportExportOwnershipMigration.js";
import {
  buildReportExportTenantScope,
  reportExportBusinessFilter,
  reportExportLocationFilter,
} from "../platform/tenancy/reportExportTenantScope.js";
import {
  assertReportExportApplyGate,
} from "../../scripts/applyReportExportTenantBackfill.js";
import {
  assertReportExportPlanArguments,
} from "../../scripts/planReportExportTenantBackfill.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

function singleTenantFixture() {
  const business = oid();
  const location = oid();
  const customer = oid();
  const appointment = oid();
  const service = oid();
  const stylist = oid();

  return {
    ids: { business, location, customer, appointment, service, stylist },
    snapshot: {
      businesses: [{ _id: business }],
      locations: [{ _id: location, business }],
      customers: [{ _id: customer, business }],
      appointments: [{ _id: appointment, business, location }],
      services: [{ _id: service, business }],
      stylists: [{ _id: stylist, business }],
      customerContactLogs: [{ _id: oid(), customer, appointment }],
      campaigns: [{ _id: oid(), recipients: [customer] }],
      rebookingCampaigns: [
        {
          _id: oid(),
          recipients: [{ customer, service, rebookedAppointment: appointment }],
        },
      ],
      inventoryItems: [{ _id: oid() }],
      customerFeedback: [{ _id: oid(), customer, appointment, service, stylist }],
      exportAuditEvents: [{ _id: oid() }],
    },
  };
}

test("report/export backfill derives trusted ownership without inventing historical location scope", () => {
  const { ids, snapshot } = singleTenantFixture();
  const plan = buildReportExportOwnershipBackfillPlan(snapshot);

  assert.equal(plan.executable, true);
  assert.equal(plan.summary.blockerCount, 0);
  assert.equal(plan.summary.operationCount, 6);

  const contact = plan.operations.find((entry) => entry.source === "customerContactLogs");
  const feedback = plan.operations.find((entry) => entry.source === "customerFeedback");
  const inventory = plan.operations.find((entry) => entry.source === "inventoryItems");
  const audit = plan.operations.find((entry) => entry.source === "exportAuditEvents");

  assert.equal(String(contact.set.business), String(ids.business));
  assert.equal(String(contact.set.location), String(ids.location));
  assert.equal(String(feedback.set.location), String(ids.location));
  assert.equal(String(inventory.set.business), String(ids.business));
  assert.equal("location" in inventory.set, false);
  assert.equal(String(audit.set.business), String(ids.business));
  assert.equal("location" in audit.set, false);

  const safe = sanitiseReportExportBackfillPlan(plan);
  assert.equal(safe.identifiersIncluded, false);
  assert.equal(safe.piiIncluded, false);
  assert.match(safe.planFingerprint, /^[a-f0-9]{64}$/);
});

test("report/export backfill blocks mixed-Business campaign provenance", () => {
  const one = singleTenantFixture();
  const otherBusiness = oid();
  const otherCustomer = oid();
  const campaign = one.snapshot.campaigns[0];

  const plan = buildReportExportOwnershipBackfillPlan({
    ...one.snapshot,
    businesses: [...one.snapshot.businesses, { _id: otherBusiness }],
    customers: [...one.snapshot.customers, { _id: otherCustomer, business: otherBusiness }],
    campaigns: [{ ...campaign, recipients: [one.ids.customer, otherCustomer] }],
    inventoryItems: [],
    exportAuditEvents: [],
  });

  assert.equal(plan.executable, false);
  assert.ok(
    plan.blockers.some(
      (entry) =>
        entry.source === "campaigns" &&
        entry.blocker === "linked-record-business-conflict"
    )
  );
});

test("report/export backfill refuses unlinked legacy inventory when more than one Business exists", () => {
  const one = singleTenantFixture();
  const otherBusiness = oid();
  const plan = buildReportExportOwnershipBackfillPlan({
    ...one.snapshot,
    businesses: [...one.snapshot.businesses, { _id: otherBusiness }],
    campaigns: [],
    rebookingCampaigns: [],
    customerContactLogs: [],
    customerFeedback: [],
    exportAuditEvents: [],
  });

  assert.equal(plan.executable, false);
  assert.ok(
    plan.blockers.some(
      (entry) =>
        entry.source === "inventoryItems" &&
        entry.blocker === "business-ownership-unproven"
    )
  );
});

test("#309 fails closed until #380 Customer/Appointment ownership is complete", () => {
  const one = singleTenantFixture();
  const plan = buildReportExportOwnershipBackfillPlan({
    ...one.snapshot,
    customers: [{ _id: one.ids.customer }],
    appointments: [{ _id: one.ids.appointment, business: one.ids.business }],
  });

  assert.equal(plan.executable, false);
  assert.ok(plan.blockers.some((entry) => entry.blocker === "customer-business-missing"));
  assert.ok(plan.blockers.some((entry) => entry.blocker === "appointment-location-missing"));
});

test("report/export fingerprint is independent of operation/blocker ordering", () => {
  const { snapshot } = singleTenantFixture();
  const plan = buildReportExportOwnershipBackfillPlan(snapshot);
  const original = calculateReportExportBackfillFingerprint(plan);
  const reordered = calculateReportExportBackfillFingerprint({
    ...plan,
    operations: [...plan.operations].reverse(),
    rollback: [...plan.rollback].reverse(),
    blockers: [...plan.blockers].reverse(),
  });

  assert.equal(original, reordered);
});

test("report/export tenant scope is derived only from effective authority", () => {
  const businessId = String(oid());
  const locationOne = String(oid());
  const locationTwo = String(oid());

  const selected = buildReportExportTenantScope({
    businessId,
    locationId: locationOne,
    locationAccessMode: "selected",
    allowedLocationIds: [locationOne, locationTwo],
  });
  assert.equal(selected.scopeMode, "selected-location");
  assert.deepEqual(reportExportBusinessFilter(selected), { business: businessId });
  assert.deepEqual(reportExportLocationFilter(selected), {
    business: businessId,
    location: locationOne,
  });

  const aggregate = buildReportExportTenantScope({
    businessId,
    locationId: null,
    locationAccessMode: "selected",
    allowedLocationIds: [locationOne, locationTwo],
  });
  assert.equal(aggregate.scopeMode, "allowed-locations");
  assert.deepEqual(reportExportLocationFilter(aggregate), {
    business: businessId,
    location: { $in: [locationOne, locationTwo] },
  });

  const businessWide = buildReportExportTenantScope({
    businessId,
    locationId: null,
    locationAccessMode: "all",
    allowedLocationIds: null,
  });
  assert.equal(businessWide.scopeMode, "business-wide");
  assert.deepEqual(reportExportLocationFilter(businessWide), { business: businessId });
});

test("report/export tenant scope fails closed on empty or invalid location authority", () => {
  const businessId = String(oid());
  const allowed = String(oid());
  const selected = String(oid());

  assert.throws(
    () =>
      buildReportExportTenantScope({
        businessId,
        locationAccessMode: "selected",
        allowedLocationIds: [],
      }),
    /no authorised reporting locations/i
  );

  assert.throws(
    () =>
      buildReportExportTenantScope({
        businessId,
        locationId: selected,
        locationAccessMode: "selected",
        allowedLocationIds: [allowed],
      }),
    /outside the active membership scope/i
  );
});

test("report/export plan and apply command gates reject unsafe invocation", () => {
  assert.doesNotThrow(() => assertReportExportPlanArguments([]));
  assert.throws(() => assertReportExportPlanArguments(["--apply"]), /read-only/i);

  const fingerprint = "a".repeat(64);
  assert.throws(() => assertReportExportApplyGate([], {}), /--apply/i);
  assert.throws(
    () =>
      assertReportExportApplyGate(["--apply", `--fingerprint=${fingerprint}`], {
        REPORT_EXPORT_TENANT_BACKFILL_CONFIRM: "WRONG",
      }),
    /REPORT_EXPORT_TENANT_BACKFILL_CONFIRM/
  );
  const gate = assertReportExportApplyGate(["--apply", `--fingerprint=${fingerprint}`], {
    REPORT_EXPORT_TENANT_BACKFILL_CONFIRM: "APPLY_REPORT_EXPORT_TENANT_BACKFILL",
  });
  assert.equal(gate.fingerprint, fingerprint);
});
