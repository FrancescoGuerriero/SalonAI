import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCrossLocationRedemptionAllowed,
  buildStoredValueLedgerPosting,
  deriveStoredValueBalance,
  planInterLocationSettlement,
} from "../platform/finance/storedValueLedger.js";

test("stored-value postings are deterministic, idempotency-keyed and retain location provenance", () => {
  const input = {
    businessId: "business-a",
    programId: "program-a",
    instrumentId: "instrument-a",
    eventType: "redeem",
    unit: "money",
    delta: -60,
    currency: "GBP",
    saleLocationId: "location-a",
    redemptionLocationId: "location-b",
    liabilityOwnerType: "business",
    sourceType: "appointment",
    sourceId: "appointment-a",
    idempotencyKey: "redeem:appointment-a",
    occurredAt: "2026-10-18T12:00:00.000Z",
  };

  const first = buildStoredValueLedgerPosting(input);
  const second = buildStoredValueLedgerPosting(input);
  assert.equal(first.ledgerFingerprint, second.ledgerFingerprint);
  assert.equal(first.saleLocationId, "location-a");
  assert.equal(first.redemptionLocationId, "location-b");
  assert.equal(first.delta, -60);
});

test("stored-value balance is derived from ledger evidence rather than mutable balance alone", () => {
  assert.equal(deriveStoredValueBalance([{ delta: 100 }, { delta: -60 }, { delta: 10 }]), 50);
});

test("financial event sign rules fail closed", () => {
  assert.throws(
    () => buildStoredValueLedgerPosting({
      businessId: "business-a",
      programId: "program-a",
      instrumentId: "instrument-a",
      eventType: "redeem",
      unit: "money",
      delta: 10,
      idempotencyKey: "bad-redeem",
    }),
    { code: "INVALID_STORED_VALUE_EVENT_SIGN" }
  );
});

test("reversal postings require explicit original-entry evidence", () => {
  assert.throws(
    () => buildStoredValueLedgerPosting({
      businessId: "business-a",
      programId: "program-a",
      instrumentId: "instrument-a",
      eventType: "reversal",
      unit: "money",
      delta: 10,
      idempotencyKey: "reversal-1",
    }),
    { code: "STORED_VALUE_REVERSAL_REFERENCE_REQUIRED" }
  );
});

test("cross-location redemption policies enforce explicit authority", () => {
  assert.equal(assertCrossLocationRedemptionAllowed({
    policy: "business-wide",
    saleLocationId: "location-a",
    redemptionLocationId: "location-b",
  }), true);

  assert.throws(
    () => assertCrossLocationRedemptionAllowed({
      policy: "same-location",
      saleLocationId: "location-a",
      redemptionLocationId: "location-b",
    }),
    { code: "CROSS_LOCATION_REDEMPTION_NOT_ALLOWED" }
  );

  assert.equal(assertCrossLocationRedemptionAllowed({
    policy: "configured",
    saleLocationId: "location-a",
    redemptionLocationId: "location-b",
    allowedLocationIds: ["location-b"],
  }), true);
});

test("business-central liability does not invent inter-location receivables", () => {
  assert.deepEqual(planInterLocationSettlement({
    businessId: "business-a",
    liabilityPolicy: "business-central",
    settlementPolicy: "receivable-payable",
    saleLocationId: "location-a",
    redemptionLocationId: "location-b",
    amount: 60,
    sourceLedgerEntryId: "ledger-a",
    idempotencyKey: "settlement-a",
  }), {
    required: false,
    reason: "business-central-liability",
    writesPerformed: false,
  });
});

test("issuing-location policy creates deterministic settlement evidence for cross-location redemption", () => {
  const plan = planInterLocationSettlement({
    businessId: "business-a",
    liabilityPolicy: "issuing-location",
    settlementPolicy: "receivable-payable",
    saleLocationId: "location-a",
    redemptionLocationId: "location-b",
    amount: 60,
    currency: "GBP",
    sourceLedgerEntryId: "ledger-a",
    idempotencyKey: "settlement-a",
  });

  assert.equal(plan.required, true);
  assert.equal(plan.fromLocationId, "location-a");
  assert.equal(plan.toLocationId, "location-b");
  assert.equal(plan.amount, 60);
  assert.match(plan.settlementFingerprint, /^[a-f0-9]{64}$/);
});
