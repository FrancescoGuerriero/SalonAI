import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { calculateTenantProductManifestHash } from "../platform/productComposition/tenantProductManifestPersistence.js";
import { inspectTrustedTenantModuleEvidence } from "../features/moduleCatalogue/moduleCatalogueTenantRuntimeEvidence.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const OTHER = "507f1f77bcf86cd799439099";
const authority = Object.freeze({
  businessId: BUSINESS,
  locationAccessMode: "all",
  permissions: ["feature-control:read"],
});
const sourceManifest = {
  schemaVersion: "1", platformVersion: "3.0.0",
  businessId: BUSINESS, verticalId: "salon", planKey: "standard",
  capabilityPackKeys: [], status: "active", manifestRevision: "1",
  deploymentProfile: "shared-saas",
};
const storedManifest = {
  ...sourceManifest, business: BUSINESS, manifestRevision: 1,
  manifestHash: calculateTenantProductManifestHash(sourceManifest),
};
const subscription = {
  business: BUSINESS, planKey: "standard", planVersion: "1",
  status: "active", lifecycleRevision: 2,
  entitlementGrants: [{ key: "appointments", source: "plan" }],
};
function sources({ manifest = storedManifest, plan = subscription } = {}) {
  const calls = [];
  return {
    calls,
    manifests: {
      findOne(filter) {
        calls.push({ kind: "manifest", filter });
        return { lean: async () => manifest };
      },
    },
    subscriptions: {
      findOne(filter) {
        calls.push({ kind: "subscription", filter });
        return { lean: async () => plan };
      },
    },
  };
}

test("trusted tenant inspection is read-only, business-bound and never asserts deployment", async () => {
  const input = sources();
  const result = await inspectTrustedTenantModuleEvidence({
    effectiveAuthority: authority,
    now: new Date("2026-11-08T12:00:00.000Z"),
  }, input);
  assert.deepEqual(input.calls, [
    { kind: "manifest", filter: { business: BUSINESS, status: "active" } },
    { kind: "subscription", filter: { business: BUSINESS } },
  ]);
  assert.equal(result.businessId, BUSINESS);
  assert.equal(result.integrity, "verified_manifest_and_subscription");
  assert.equal(result.readOnly, true);
  const bookings = result.entries.find((row) => row.moduleId === "01");
  assert.equal(bookings.manifestSelected, true);
  assert.equal(bookings.subscriptionEntitled, true);
  assert.equal(bookings.runtimeVerified, null);
  assert.equal(bookings.productionAccepted, null);
  assert.equal(bookings.activationAuthorised, false);
  const staff = result.entries.find((row) => row.moduleId === "02");
  assert.equal(staff.manifestSelected, true);
  assert.equal(staff.subscriptionEntitled, false);
  assert.equal(result.deploymentVerified, null);
  assert.equal(result.productionAccepted, null);
  assert.equal(Object.hasOwn(result, "entitlementGrants"), false);
});

test("selected-location membership or missing feature permission cannot read business-wide records", async () => {
  for (const changed of [
    { locationAccessMode: "selected", allowedLocationIds: [BUSINESS] },
    { permissions: [] },
    { businessId: "invalid" },
  ]) {
    const input = sources();
    await assert.rejects(inspectTrustedTenantModuleEvidence({
      effectiveAuthority: { ...authority, ...changed },
    }, input));
    assert.equal(input.calls.length, 0);
  }
});

test("foreign ownership, hash changes, future dates and inconsistent plan fail closed", async () => {
  const cases = [
    sources({ manifest: { ...storedManifest, business: OTHER } }),
    sources({ plan: { ...subscription, business: OTHER } }),
    sources({ manifest: { ...storedManifest, manifestHash: "a".repeat(64) } }),
    sources({ manifest: { ...storedManifest, planKey: "different" } }),
    sources({ manifest: {
      ...storedManifest,
      effectiveFrom: new Date("2100-01-01T00:00:00Z"),
    } }),
  ];
  for (const input of cases) {
    await assert.rejects(inspectTrustedTenantModuleEvidence({
      effectiveAuthority: authority,
      now: new Date("2026-11-08T12:00:00Z"),
    }, input));
  }
});

test("missing persisted records produce unknown evidence, not false activation", async () => {
  const result = await inspectTrustedTenantModuleEvidence({
    effectiveAuthority: authority,
  }, sources({ manifest: null }));
  assert.equal(result.integrity, "missing_source_records");
  assert.deepEqual(result.entries, []);
  assert.equal(result.runtimeVerified, null);
  assert.equal(result.productionAccepted, null);
});

test("route and frontend use trusted server identity and no write endpoints", async () => {
  const [routes, ui] = await Promise.all([
    readFile(new URL("../routes/systemAdministrationRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../../../frontend/src/pages/ModuleCatalogueDashboardPage.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(routes,
    /"\/module-catalogue\/tenant-evidence",\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /effectiveAuthority: request\.effectiveAuthority/);
  assert.match(ui, /API\.get\("\/system-administration\/module-catalogue\/tenant-evidence"\)/);
  assert.doesNotMatch(ui, /API\.(post|put|patch|delete)\(/);
  assert.match(ui, /Production acceptance/);
});
