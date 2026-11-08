import assert from "node:assert/strict";
import test from "node:test";
import {
  invokeGovernedBusinessMetrics,
  validateAiWorkforceMetricEvidence,
} from "../features/aiPlatform/aiWorkforceReadOnlyMetricsInvocation.js";

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
const composition = {
  manifest: { businessId: BUSINESS, status: "active" },
  vertical: { id: "salon" },
  enabledCapabilityPackKeys: ["ai", "appointments"],
};
const input = { user: { _id: USER }, effectiveAuthority: authority, composition, periodDays: 30 };
function harness({ payload, failure, auditFailure } = {}) {
  const calls = { reads: [], creates: [], updates: [], audits: [] };
  const dependencies = {
    readMetrics: async (args) => {
      calls.reads.push(args);
      if (failure) throw failure;
      return payload || {
        scope: { businessId: BUSINESS, locationId: LOCATION, tenantScoped: true },
        metrics: [{ key: "bookings", version: "2.1.0", label: "Bookings", value: 4, unit: "count" }],
      };
    },
    runs: {
      create: async (doc) => { calls.creates.push(doc); return { _id: USER }; },
      updateOne: async (...args) => { calls.updates.push(args); },
    },
    audits: {
      create: async (doc) => {
        calls.audits.push(doc);
        if (auditFailure) throw auditFailure;
      },
    },
  };
  return { calls, dependencies };
}

test("read-only tool invocation rechecks trust, records a run and audits minimal evidence", async () => {
  const { calls, dependencies } = harness();
  const result = await invokeGovernedBusinessMetrics(input, dependencies);
  assert.equal(result.businessId, BUSINESS);
  assert.equal(result.locationId, LOCATION);
  assert.equal(result.mutationAuthorised, false);
  assert.equal(result.metrics[0].value, 4);
  assert.equal(calls.reads.length, 1);
  assert.deepEqual(calls.reads[0].allowedLocationIds, [LOCATION]);
  assert.equal(calls.creates[0].effectiveAutonomy, "A0");
  assert.equal(calls.updates[0][1].$set.status, "completed");
  assert.equal(calls.audits[0].after.metricCount, 1);
  assert.equal(calls.audits[0].metadata.businessId, BUSINESS);
  assert.equal(JSON.stringify(calls.audits).includes("Bookings"), false);
});

test("denied permissions and foreign tenants/locations cannot query or create runs", async () => {
  for (const overrides of [
    { effectiveAuthority: { ...authority, permissions: ["ai:use"] } },
    { effectiveAuthority: { ...authority, permissions: ["appointment:read"] } },
    { composition: { ...composition, manifest: { businessId: FOREIGN, status: "active" } } },
    { locationId: OTHER_LOCATION },
    { composition: { ...composition, enabledCapabilityPackKeys: ["appointments"] } },
    { user: {} },
    { periodDays: 1000 },
  ]) {
    const { calls, dependencies } = harness();
    await assert.rejects(
      invokeGovernedBusinessMetrics({ ...input, ...overrides }, dependencies),
    );
    assert.equal(calls.reads.length, 0);
    assert.equal(calls.creates.length, 0);
  }
});

test("foreign or missing evidence scope fails closed and is audited as failure", async () => {
  for (const scope of [
    { businessId: FOREIGN, locationId: LOCATION, tenantScoped: true },
    { businessId: BUSINESS, locationId: OTHER_LOCATION, tenantScoped: true },
    { businessId: BUSINESS, locationId: LOCATION },
  ]) {
    const { calls, dependencies } = harness({ payload: { scope, metrics: [] } });
    await assert.rejects(invokeGovernedBusinessMetrics(input, dependencies), /scope evidence/);
    assert.equal(calls.updates[0][1].$set.status, "failed");
    assert.equal(calls.audits[0].after.status, "failed");
  }
});

test("canonical read failure is recorded, not misreported as success", async () => {
  const { calls, dependencies } = harness({ failure: new Error("read failed") });
  await assert.rejects(invokeGovernedBusinessMetrics(input, dependencies), /read failed/);
  assert.equal(calls.updates[0][1].$set.status, "failed");
  assert.equal(calls.audits[0].after.metricCount, 0);
});

test("audit failure prevents returning metrics", async () => {
  const { dependencies } = harness({ auditFailure: new Error("audit unavailable") });
  await assert.rejects(invokeGovernedBusinessMetrics(input, dependencies), /audit unavailable/);
});

test("AI metric evidence rejects unknown keys, duplicates, stale versions and nonfinite values", () => {
  const metric = { key: "bookings", version: "2.1.0", label: "Bookings", value: 4, unit: "count" };
  const valid = { ...input.effectiveAuthority };
  assert.deepEqual(validateAiWorkforceMetricEvidence([metric], valid), [metric]);
  for (const candidate of [
    { ...metric, key: "customer-lifetime-value" },
    { ...metric, version: "1.0.0" },
    { ...metric, unit: "GBP" },
    { ...metric, value: Number.POSITIVE_INFINITY },
    { ...metric, label: "Not the canonical label" },
  ]) {
    assert.throws(() => validateAiWorkforceMetricEvidence([candidate], valid));
  }
  assert.throws(() => validateAiWorkforceMetricEvidence([metric, metric], valid), /duplicate/);
  assert.throws(() => validateAiWorkforceMetricEvidence([metric], {
    ...valid, permissions: ["ai:use"],
  }), /permission/i);
});
