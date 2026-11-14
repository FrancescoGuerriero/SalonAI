import assert from "node:assert/strict";
import test from "node:test";
import { inspectAiOutcomeAuditIntegrity } from "../features/aiPlatform/aiOutcomeAuditReconciliation.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const FOREIGN = "507f1f77bcf86cd799439099";
const LOCATION = "507f1f77bcf86cd799439025";
const FOREIGN_LOCATION = "507f1f77bcf86cd799439026";
const PROPOSAL = "507f1f77bcf86cd799439022";
const ACTOR = "507f1f77bcf86cd799439024";
const ONE = "507f1f77bcf86cd799439031";
const TWO = "507f1f77bcf86cd799439032";
const THREE = "507f1f77bcf86cd799439033";

const authority = {
  businessId: BUSINESS, locationAccessMode: "selected",
  allowedLocationIds: [LOCATION],
  permissions: ["ai:use", "reports:read"],
};
const outcome = (id, overrides = {}) => ({
  _id: id, business: BUSINESS, location: LOCATION,
  proposal: PROPOSAL, observedBy: ACTOR, status: "implemented",
  taskSuccess: true, policyViolation: false, reversed: false,
  ...overrides,
});
const audit = (id, overrides = {}) => ({
  resourceId: PROPOSAL, actor: ACTOR,
  after: {
    outcomeId: id, status: "implemented", taskSuccess: true,
    policyViolation: false, reversed: false,
  },
  metadata: { businessId: BUSINESS, automaticExecution: false },
  ...overrides,
});

function fixture(rows, auditRows) {
  const calls = [];
  const chain = (value) => ({
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    lean: async () => value,
  });
  return {
    calls,
    outcomes: { find(filter) { calls.push({ kind: "outcomes", filter }); return chain(rows); } },
    audits: { find(filter) { calls.push({ kind: "audits", filter }); return chain(auditRows); } },
  };
}

test("reports missing, duplicate and contradictory outcome audit evidence", async () => {
  const deps = fixture([outcome(ONE), outcome(TWO), outcome(THREE)], [
    audit(TWO), audit(TWO),
    audit(THREE, { after: { ...audit(THREE).after, status: "reversed" } }),
  ]);
  const result = await inspectAiOutcomeAuditIntegrity({ effectiveAuthority: authority }, deps);
  assert.deepEqual(result.discrepancies.map((entry) => entry.issue), [
    "missing_outcome_audit", "duplicate_outcome_audit", "outcome_audit_provenance_mismatch",
  ]);
  assert.equal(result.inspectedCount, 3);
  assert.equal(result.discrepancyCount, 3);
  assert.equal(result.readOnly, true);
  assert.equal(result.repairPerformed, false);
  assert.equal(result.productionAccepted, null);
  assert.equal(deps.calls[0].filter.business, BUSINESS);
  assert.deepEqual(deps.calls[0].filter.location, { $in: [LOCATION] });
  assert.equal(deps.calls[1].filter["metadata.businessId"], BUSINESS);
  assert.deepEqual(deps.calls[1].filter.resourceId.$in, [PROPOSAL]);
});

test("valid outcome/audit provenance remains discrepancy-free", async () => {
  const result = await inspectAiOutcomeAuditIntegrity({ effectiveAuthority: authority },
    fixture([outcome(ONE)], [audit(ONE)]));
  assert.equal(result.discrepancyCount, 0);
  assert.equal(Object.isFrozen(result), true);
});

test("incorrect actor, proposal, flags and automatic-execution claims fail audit reconciliation", async () => {
  const variants = [
    { actor: FOREIGN },
    { resourceId: FOREIGN },
    { after: { ...audit(ONE).after, taskSuccess: false } },
    { metadata: { businessId: BUSINESS, automaticExecution: true } },
  ];
  for (const bad of variants) {
    const report = await inspectAiOutcomeAuditIntegrity({ effectiveAuthority: authority },
      fixture([outcome(ONE)], [audit(ONE, bad)]));
    assert.equal(report.discrepancies[0].issue, "outcome_audit_provenance_mismatch");
  }
});

test("refuses missing authority, unrelated location, invalid limits or foreign rows", async () => {
  for (const overrides of [
    { effectiveAuthority: { ...authority, permissions: ["ai:use"] } },
    { effectiveAuthority: { ...authority, permissions: ["reports:read"] } },
    { effectiveAuthority: { ...authority, businessId: "invalid" } },
    { locationId: FOREIGN_LOCATION },
    { limit: 101 },
  ]) {
    const deps = fixture([], []);
    await assert.rejects(inspectAiOutcomeAuditIntegrity({
      effectiveAuthority: authority, ...overrides,
    }, deps));
    assert.equal(deps.calls.length, 0);
  }
  for (const rows of [
    [outcome(ONE, { business: FOREIGN })],
    [outcome(ONE), outcome(ONE)],
    [outcome("invalid")],
    null,
  ]) {
    await assert.rejects(inspectAiOutcomeAuditIntegrity({
      effectiveAuthority: authority,
    }, fixture(rows, [])));
  }
});

test("empty outcome set avoids an audit lookup", async () => {
  const deps = fixture([], []);
  const report = await inspectAiOutcomeAuditIntegrity({ effectiveAuthority: authority }, deps);
  assert.equal(report.inspectedCount, 0);
  assert.equal(deps.calls.length, 1);
});
