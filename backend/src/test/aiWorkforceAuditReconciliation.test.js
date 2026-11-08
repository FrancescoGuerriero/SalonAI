import assert from "node:assert/strict";
import test from "node:test";
import { inspectAiMetricsRunAuditIntegrity } from "../features/aiPlatform/aiWorkforceAuditReconciliation.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const FOREIGN = "507f1f77bcf86cd799439099";
const LOCATION = "507f1f77bcf86cd799439022";
const FOREIGN_LOCATION = "507f1f77bcf86cd799439029";
const RUN1 = "507f1f77bcf86cd799439031";
const RUN2 = "507f1f77bcf86cd799439032";
const RUN3 = "507f1f77bcf86cd799439033";
const NOW = new Date("2026-11-08T13:00:00Z");
const authority = {
  businessId: BUSINESS,
  locationId: LOCATION,
  locationAccessMode: "selected",
  allowedLocationIds: [LOCATION],
  permissions: ["ai:use", "reports:read"],
};
const run = (id, status, startedAt, location = LOCATION) => ({
  _id: id,
  business: BUSINESS,
  location,
  status,
  agentKey: "business-adviser",
  startedAt: new Date(startedAt),
});
const audit = (id, status = "completed", locationId = LOCATION) => ({
  resourceId: id, after: { status, toolKey: "business.metrics.read" },
  metadata: { businessId: BUSINESS, locationId },
});
function fixture(rows, entries) {
  const calls = [];
  const chain = (value) => ({
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    lean: async () => value,
  });
  return {
    calls,
    runs: { find(filter) { calls.push({ kind: "runs", filter }); return chain(rows); } },
    audits: { find(filter) { calls.push({ kind: "audits", filter }); return chain(entries); } },
  };
}
const options = { effectiveAuthority: authority, now: NOW, limit: 25 };

test("reports only stale, unaudited, and mismatched terminal runs", async () => {
  const deps = fixture([
    run(RUN1, "started", "2026-11-08T12:50:00Z"),
    run(RUN2, "completed", "2026-11-08T12:58:00Z"),
    run(RUN3, "failed", "2026-11-08T12:59:00Z"),
  ], [audit(RUN3, "completed")]);
  const output = await inspectAiMetricsRunAuditIntegrity(options, deps);
  assert.equal(output.inspectedCount, 3);
  assert.equal(output.discrepancyCount, 3);
  assert.deepEqual(output.discrepancies.map((d) => d.issue), [
    "stale_started_run", "missing_terminal_audit", "audit_scope_or_status_mismatch",
  ]);
  assert.equal(output.repairPerformed, false);
  assert.equal(output.readOnly, true);
  assert.equal(deps.calls[0].filter.business, BUSINESS);
  assert.deepEqual(deps.calls[0].filter.location, { $in: [LOCATION] });
  assert.equal(deps.calls[1].filter["metadata.businessId"], BUSINESS);
  assert.deepEqual(deps.calls[1].filter.resourceId.$in, [RUN1, RUN2, RUN3]);
});

test("a consistent audited completion produces zero discrepancies", async () => {
  const result = await inspectAiMetricsRunAuditIntegrity(options, fixture(
    [run(RUN1, "completed", "2026-11-08T12:58:00Z")], [audit(RUN1)],
  ));
  assert.equal(result.discrepancyCount, 0);
});

test("unauthorised tenant, location, permissions or unbounded requests cannot query evidence", async () => {
  for (const overrides of [
    { effectiveAuthority: { ...authority, businessId: FOREIGN, permissions: [] } },
    { effectiveAuthority: { ...authority, businessId: "invalid" } },
    { effectiveAuthority: { ...authority, permissions: ["ai:use"] } },
    { effectiveAuthority: { ...authority, permissions: ["reports:read"] } },
    { locationId: FOREIGN_LOCATION },
    { limit: 1000 },
    { staleAfterMs: 100 },
  ]) {
    const deps = fixture([], []);
    await assert.rejects(inspectAiMetricsRunAuditIntegrity({ ...options, ...overrides }, deps));
    assert.equal(deps.calls.length, 0);
  }
});

test("duplicate audits, invalid run ids and malformed returned data fail safely", async () => {
  const duplicate = await inspectAiMetricsRunAuditIntegrity(options, fixture(
    [run(RUN1, "completed", "2026-11-08T12:58:00Z")],
    [audit(RUN1), audit(RUN1)],
  ));
  assert.equal(duplicate.discrepancies[0].issue, "duplicate_terminal_audit");
  await assert.rejects(inspectAiMetricsRunAuditIntegrity(options, fixture(
    [run(RUN1, "completed", "2026-11-08T12:58:00Z"), run(RUN1, "failed", "2026-11-08T12:58:00Z")], [],
  )), /duplicated/);
  await assert.rejects(inspectAiMetricsRunAuditIntegrity(options, fixture(null, [])), /unavailable/);
});

test("fresh in-progress runs and empty batches remain read-only", async () => {
  const recent = await inspectAiMetricsRunAuditIntegrity(options, fixture(
    [run(RUN1, "started", "2026-11-08T12:59:30Z")], [],
  ));
  assert.equal(recent.discrepancyCount, 0);
  const deps = fixture([], []);
  const empty = await inspectAiMetricsRunAuditIntegrity(options, deps);
  assert.equal(empty.inspectedCount, 0);
  assert.equal(deps.calls.length, 1);
});
