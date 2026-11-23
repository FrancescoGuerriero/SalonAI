import assert from "node:assert/strict";
import test from "node:test";
import { normaliseTenantProductManifest } from "../platform/productComposition/tenantProductManifest.js";
import { calculateTenantProductManifestHash } from "../platform/productComposition/tenantProductManifestPersistence.js";
import {
  assertManagementBiEntitlement,
  createRequireManagementBiEntitlement,
} from "../features/analytics/managementBiEntitlementService.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const FOREIGN = "507f1f77bcf86cd799439022";
const NOW = new Date("2026-11-23T10:00:00Z");

function manifest({ business = BUSINESS, capabilities = ["analytics"], effectiveFrom = "" } = {}) {
  const data = normaliseTenantProductManifest({
    schemaVersion: "1", platformVersion: "3.0.0",
    businessId: business, verticalId: "salon",
    planKey: "standard", capabilityPackKeys: capabilities,
    status: "active", manifestRevision: "4", effectiveFrom,
    deploymentProfile: "shared-saas",
  });
  return {
    ...data, business,
    manifestRevision: Number(data.manifestRevision),
    manifestHash: calculateTenantProductManifestHash(data),
  };
}

function subscription({ business = BUSINESS, status = "active", grants = ["analytics"] } = {}) {
  return {
    business, planKey: "standard", planVersion: "1",
    lifecycleRevision: 7, status,
    entitlementGrants: grants.map((key) => ({ key, source: "plan" })),
  };
}

function mock(manifestRecord = manifest(), subscriptionRecord = subscription()) {
  const queries = { manifests: [], subscriptions: [] };
  return {
    queries,
    manifests: { findOne: (query) => {
      queries.manifests.push(query);
      return { lean: async () => manifestRecord };
    } },
    subscriptions: { findOne: (query) => {
      queries.subscriptions.push(query);
      return { lean: async () => subscriptionRecord };
    } },
  };
}

const authority = { businessId: BUSINESS, locationAccessMode: "selected",
  locationId: "507f1f77bcf86cd799439031",
  permissions: ["premium-analytics:read"] };

const check = (f, a = authority) => assertManagementBiEntitlement(a, { ...f, now: NOW });
const errorCode = (code) => (error) => error.code === code && error.statusCode === 403;

test("BI runtime grants only a verified active tenant with canonical analytics entitlement", async () => {
  const f = mock();
  const result = await check(f);
  assert.equal(result.businessId, BUSINESS);
  assert.equal(result.capabilityPackKey, "analytics");
  assert.equal(result.entitled, true);
  assert.equal(result.readOnly, true);
  assert.equal(result.manifestRevision, "4");
  assert.equal(result.subscriptionRevision, 7);
  assert.equal(result.productionAccepted, null);
  assert.deepEqual(f.queries.manifests, [{ business: BUSINESS, status: "active" }]);
  assert.deepEqual(f.queries.subscriptions, [{ business: BUSINESS }]);
});

test("missing or mismatched persisted tenant records always fail before report data access", async () => {
  for (const f of [
    mock(null, subscription()), mock(manifest(), null),
    mock(manifest({ business: FOREIGN }), subscription()),
    mock(manifest(), subscription({ business: FOREIGN })),
  ]) {
    await assert.rejects(check(f), errorCode("BI_TENANT_RECORDS_REQUIRED"));
  }
  await assert.rejects(check(mock(), { businessId: "bad" }),
    errorCode("BI_TENANT_REQUIRED"));
});

test("hash tampering, manifest effective date and divergent plan fail closed", async () => {
  const changed = { ...manifest(), manifestHash: "f".repeat(64) };
  await assert.rejects(check(mock(changed)), errorCode("BI_MANIFEST_UNTRUSTED"));
  const future = manifest({ effectiveFrom: "2027-01-01T00:00:00.000Z" });
  await assert.rejects(check(mock(future)), errorCode("BI_MANIFEST_UNTRUSTED"));
  const wrongPlan = { ...manifest(), planKey: "enterprise" };
  wrongPlan.manifestHash = calculateTenantProductManifestHash({
    ...wrongPlan, businessId: BUSINESS, manifestRevision: "4",
  });
  await assert.rejects(check(mock(wrongPlan)), errorCode("BI_TENANT_PLAN_MISMATCH"));
});

test("subscription state and analytics grants cannot elevate a selected-location user", async () => {
  for (const status of ["suspended", "cancelled", "archived", "provisioning"]) {
    await assert.rejects(check(mock(manifest(), subscription({ status }))),
      errorCode("BI_SUBSCRIPTION_INACTIVE"));
  }
  await assert.rejects(
    check(mock(manifest(), subscription({ grants: ["appointments"] }))),
    errorCode("BI_CAPABILITY_NOT_ENTITLED"));
  // All registered service verticals include analytics in their defaults.
  // A subscription entitlement can therefore enable that vertical default
  // even when the manifest does not additionally list it.
  const verticalDefault = await check(mock(manifest({ capabilities: [] })));
  assert.equal(verticalDefault.entitled, true);

  const draft = { ...manifest(), status: "draft" };
  draft.manifestHash = calculateTenantProductManifestHash({
    ...draft, businessId: BUSINESS, manifestRevision: "4",
  });
  await assert.rejects(check(mock(draft)),
    errorCode("BI_TENANT_COMPOSITION_INVALID"));
  await assert.rejects(
    check(mock(manifest(), { ...subscription(), planVersion: "unknown" })),
    errorCode("BI_TENANT_COMPOSITION_INVALID"));
});

test("trial and past_due use existing canonical subscription lifecycle rules", async () => {
  for (const status of ["trial", "past_due"]) {
    const result = await check(mock(manifest(), subscription({ status })));
    assert.equal(result.entitled, true);
  }
});

test("entitlement middleware calls next with trusted result or fail-closed error", async () => {
  const calls = [];
  const middleware = createRequireManagementBiEntitlement(async (a) => {
    assert.equal(a, authority);
    return Object.freeze({ entitled: true, capabilityPackKey: "analytics" });
  });
  const request = { effectiveAuthority: authority };
  await middleware(request, null, (error) => calls.push(error || null));
  assert.equal(calls.length, 1);
  assert.equal(calls[0], null);
  assert.equal(request.managementBiEntitlement.entitled, true);

  const failed = createRequireManagementBiEntitlement(async () => {
    const error = new Error("No entitlement");
    error.code = "BI_CAPABILITY_NOT_ENTITLED";
    error.statusCode = 403;
    throw error;
  });
  const requestWithoutResult = { effectiveAuthority: authority };
  await failed(requestWithoutResult, null, (error) => calls.push(error));
  assert.equal(calls[1].code, "BI_CAPABILITY_NOT_ENTITLED");
  assert.equal(requestWithoutResult.managementBiEntitlement, undefined);
});
