import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateTenantProductManifestHash,
} from "../platform/productComposition/tenantProductManifestPersistence.js";
import {
  invokeMetricsWithResolvedTenantAuthority,
  resolveTrustedAiToolContext,
} from "../features/aiPlatform/aiWorkforceTrustedTenantResolver.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const FOREIGN = "507f1f77bcf86cd799439099";
const LOCATION = "507f1f77bcf86cd799439022";
const OTHER_LOCATION = "507f1f77bcf86cd799439023";
const USER = "507f1f77bcf86cd799439024";
const authority = {
  businessId: BUSINESS,
  locationId: LOCATION,
  locationAccessMode: "selected",
  allowedLocationIds: [LOCATION],
  permissions: ["ai:use", "appointment:read"],
};
const manifest = {
  businessId: BUSINESS,
  schemaVersion: "1",
  platformVersion: "3.0.0",
  verticalId: "salon",
  planKey: "ai-business",
  capabilityPackKeys: [],
  manifestRevision: "1",
  status: "active",
  deploymentProfile: "shared-saas",
};
const record = {
  ...manifest,
  business: BUSINESS,
  manifestRevision: 1,
  manifestHash: calculateTenantProductManifestHash(manifest),
};
const subscription = {
  business: BUSINESS,
  planKey: "ai-business",
  planVersion: "1",
  status: "active",
  lifecycleRevision: 1,
  entitlementGrants: [
    { key: "ai", source: "plan" },
    { key: "appointments", source: "plan" },
    { key: "ai-tools", source: "plan" },
  ],
};

function providers({ manifestRecord = record, subscriptionRecord = subscription } = {}) {
  const calls = [];
  return {
    calls,
    manifests: {
      findOne: (filter) => {
        calls.push({ model: "manifest", filter });
        return { lean: async () => manifestRecord };
      },
    },
    subscriptions: {
      findOne: (filter) => {
        calls.push({ model: "subscription", filter });
        return { lean: async () => subscriptionRecord };
      },
    },
  };
}

test("trusted resolver reads tenant-scoped authoritative records and intersects capability grants", async () => {
  const source = providers();
  const result = await resolveTrustedAiToolContext(authority, source);
  assert.deepEqual(source.calls, [
    { model: "manifest", filter: { business: BUSINESS, status: "active" } },
    { model: "subscription", filter: { business: BUSINESS } },
  ]);
  assert.equal(result.composition.manifest.businessId, BUSINESS);
  assert.equal(result.manifestRevision, "1");
  assert.ok(result.composition.enabledCapabilityPackKeys.includes("ai"));
  assert.ok(result.enabledEntitlements.includes("ai-tools"));
});

test("foreign, missing or inconsistent canonical records fail closed", async () => {
  const cases = [
    providers({ manifestRecord: null }),
    providers({ subscriptionRecord: null }),
    providers({ manifestRecord: { ...record, business: FOREIGN } }),
    providers({ subscriptionRecord: { ...subscription, business: FOREIGN } }),
    providers({ manifestRecord: { ...record, manifestHash: "0".repeat(64) } }),
    providers({ subscriptionRecord: { ...subscription, planKey: "standard" } }),
    providers({ subscriptionRecord: { ...subscription, status: "suspended" } }),
    providers({ subscriptionRecord: {
      ...subscription,
      entitlementGrants: [{ key: "appointments", source: "plan" }],
    } }),
  ];
  for (const source of cases) {
    await assert.rejects(resolveTrustedAiToolContext(authority, source));
  }
  await assert.rejects(resolveTrustedAiToolContext({ ...authority, businessId: "invalid" }, providers()));
});

test("future-effective manifests cannot activate AI tools", async () => {
  const future = { ...manifest, effectiveFrom: "2100-01-01T00:00:00.000Z" };
  const source = providers({ manifestRecord: {
    ...record,
    effectiveFrom: new Date(future.effectiveFrom),
    manifestHash: calculateTenantProductManifestHash(future),
  } });
  await assert.rejects(
    resolveTrustedAiToolContext(authority, { ...source, now: new Date("2026-11-08T12:00:00.000Z") }),
    /not yet effective/
  );
});

test("internal invocation consumes resolved backend data and audits without returning a bearer grant", async () => {
  const source = providers();
  const events = { reads: [], runs: [], updates: [], audits: [] };
  const result = await invokeMetricsWithResolvedTenantAuthority(
    {
      effectiveAuthority: authority,
      user: { _id: USER },
      locationId: LOCATION,
      periodDays: 30,
    },
    {
      ...source,
      invocation: {
        readMetrics: async (args) => {
          events.reads.push(args);
          return {
            scope: { tenantScoped: true, businessId: BUSINESS, locationId: LOCATION },
            metrics: [{ key: "bookings", label: "Bookings", value: 2, version: "2.1.0", unit: "count" }],
          };
        },
        runs: {
          create: async (payload) => { events.runs.push(payload); return { _id: USER }; },
          updateOne: async (...args) => { events.updates.push(args); },
        },
        audits: { create: async (payload) => { events.audits.push(payload); } },
      },
    }
  );
  assert.equal(result.businessId, BUSINESS);
  assert.equal(result.mutationAuthorised, false);
  assert.equal(events.reads.length, 1);
  assert.equal(events.runs[0].status, "started");
  assert.equal(events.audits[0].after.status, "completed");
  assert.equal(Object.hasOwn(result, "enabledEntitlements"), false);
});

test("unauthorised location cannot invoke canonical metrics after trusted resolution", async () => {
  const source = providers();
  await assert.rejects(invokeMetricsWithResolvedTenantAuthority({
    effectiveAuthority: authority, user: { _id: USER }, locationId: OTHER_LOCATION,
  }, source), /outside the trusted membership/);
});
