import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { summariseModuleOperationalGaps } from "../features/moduleCatalogue/moduleCatalogueGapSummary.js";
import {
  inspectModuleOperationalAcceptance,
} from "../features/moduleCatalogue/moduleCatalogueOperationalAcceptance.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const authority = Object.freeze({
  businessId: BUSINESS,
  locationAccessMode: "all",
  permissions: ["feature-control:read"],
});
const tenants = [
  {
    moduleId: "01", manifestSelected: true, subscriptionEntitled: true,
    subscriptionStatus: "active",
  },
  {
    moduleId: "02", manifestSelected: true, subscriptionEntitled: false,
    subscriptionStatus: "active",
  },
  {
    moduleId: "19", manifestSelected: false, subscriptionEntitled: true,
    subscriptionStatus: "suspended",
  },
];
function fixture(records = tenants, integrity = "verified_manifest_and_subscription") {
  const seen = [];
  return {
    seen,
    tenantInspector: async ({ effectiveAuthority }) => {
      seen.push(effectiveAuthority);
      return {
        businessId: effectiveAuthority.businessId,
        integrity, entries: records,
      };
    },
  };
}

test("acceptance checklist reports evidenced tenant prerequisites without approving a module", async () => {
  const input = fixture();
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, input);
  assert.equal(result.assessmentCount, 48);
  assert.equal(result.acceptedCount, 0);
  assert.equal(result.assessmentNotApproval, true);
  assert.equal(result.readOnly, true);
  assert.equal(input.seen[0], authority);
  const appointments = result.entries.find((entry) => entry.moduleId === "01");
  assert.equal(appointments.readyForProductionAcceptance, false);
  assert.equal(appointments.productionAccepted, null);
  assert.equal(appointments.activationAuthorised, false);
  assert.equal(appointments.confirmedBlockers.length, 0);
  assert.ok(appointments.checks.some((check) =>
    check.key === "manifest_composition" && check.status === "evidence_present"));
  assert.ok(appointments.checks.some((check) =>
    check.key === "subscription_entitlement" && check.status === "evidence_present"));
  assert.ok(appointments.outstandingVerification.includes("module_api_acceptance"));
  assert.ok(appointments.outstandingVerification.includes("tenant_location_isolation"));
  assert.ok(appointments.outstandingVerification.includes("production_signoff"));
});

test("denied subscription and suspended lifecycle are confirmed blockers", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  const workforce = result.entries.find((entry) => entry.moduleId === "02");
  assert.ok(workforce.confirmedBlockers.includes("subscription_entitlement"));
  const receptionist = result.entries.find((entry) => entry.moduleId === "19");
  assert.ok(receptionist.confirmedBlockers.includes("manifest_composition"));
  assert.ok(receptionist.confirmedBlockers.includes("subscription_lifecycle"));
  assert.equal(receptionist.readyForProductionAcceptance, false);
});

test("unmapped candidates and missing records stay unknown without invented failures", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture([], "missing_source_records"));
  const slot = result.entries.find((entry) => entry.moduleId === "22");
  assert.equal(slot.checks.find((check) =>
    check.key === "canonical_capability_mapping").status, "not_verified");
  assert.equal(slot.checks.find((check) =>
    check.key === "trusted_tenant_records").status, "not_verified");
  assert.equal(slot.checks.find((check) =>
    check.key === "subscription_entitlement").status, "not_verified");
  assert.equal(slot.confirmedBlockers.length, 0);
  assert.equal(slot.productionAccepted, null);
  assert.equal(result.entries.every((entry) => !entry.activationAuthorised), true);
});

test("tenant authority failures are propagated without returning catalogue evidence", async () => {
  for (const issue of ["membership denied", "business mismatch", "read permission denied"]) {
    await assert.rejects(inspectModuleOperationalAcceptance({
      effectiveAuthority: authority,
    }, {
      tenantInspector: async () => { throw new Error(issue); },
    }), new RegExp(issue));
  }
});

test("module management route enforces trusted authority and UI does not write state", async () => {
  const [routes, page] = await Promise.all([
    readFile(new URL("../routes/systemAdministrationRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/ModuleCatalogueDashboardPage.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes,
    /"\/module-catalogue\/operational-acceptance",\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /effectiveAuthority: request\.effectiveAuthority/);
  assert.match(page,
    /API\.get\("\/system-administration\/module-catalogue\/operational-acceptance"\)/);
  assert.match(page, /Production approval: not granted/);
  assert.doesNotMatch(page, /API\.(post|put|patch|delete)\(/);
});

test("catalogue delivery gap summary includes every requirement and candidate without implied approval", async () => {
  const result = await inspectModuleOperationalAcceptance({
    effectiveAuthority: authority,
  }, fixture());
  const summary = result.deliveryGaps;
  assert.equal(summary.readOnly, true);
  assert.equal(summary.assessmentNotApproval, true);
  assert.equal(summary.activationAuthorised, false);
  assert.equal(summary.productionAcceptedCount, null);
  assert.equal(summary.totals.count, 48);
  assert.equal(summary.priorities.reduce((total, row) => total + row.count, 0), 48);
  assert.equal(summary.categories.reduce((total, row) => total + row.count, 0), 48);
  assert.deepEqual(summary.priorities.map((row) => row.priority), ["P0", "P1", "P2", "P3"]);
  assert.ok(summary.entries.some((row) =>
    row.moduleId === "02" && row.confirmedBlockers.includes("subscription_entitlement")));
  assert.ok(summary.entries.some((row) =>
    row.moduleId === "18" && row.aiOpportunity.includes("assistant")));
  assert.ok(summary.entries.some((row) =>
    row.moduleId === "22" && row.canonicalMappingVerified === false));
  assert.ok(summary.entries.every((row) =>
    row.activationAuthorised === false && row.productionAccepted === null));
});

test("delivery-gap summary rejects duplicate or unknown identifiers and remains read-only", () => {
  const assessment = {
    moduleId: "01",
    checks: [{ key: "tenant_location_isolation", status: "not_verified" }],
  };
  const summary = summariseModuleOperationalGaps([assessment]);
  assert.equal(summary.entries[0].planningState, "verification_required");
  assert.equal(summary.totals.verificationRequired, 1);
  assert.equal(Object.isFrozen(summary.entries), true);
  assert.equal(Object.isFrozen(summary.entries[0]), true);
  assert.throws(() => summariseModuleOperationalGaps([assessment, assessment]), /Duplicate/);
  assert.throws(() => summariseModuleOperationalGaps([{ moduleId: "UNKNOWN", checks: [] }]),
    (error) => error.code === "UNKNOWN_MODULE_CATALOGUE_ID");
  assert.throws(() => summariseModuleOperationalGaps({}), TypeError);
});
