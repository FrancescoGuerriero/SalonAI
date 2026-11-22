import assert from "node:assert/strict";
import test from "node:test";
import { inspectSellerOrderSourceEvidence } from "../features/partnerMarketplace/sellerChannelOrderEvidence.js";

test("complete marketplace order source evidence is preserved as decimal text", () => {
  const observed = inspectSellerOrderSourceEvidence({
    amount: " 125.40 ", currency: "GBP", placedAt: "2026-10-01T11:00:00.000Z",
  });
  assert.deepEqual(observed, {
    state: "source_evidence_present",
    sourceAmount: "125.40", sourceCurrency: "GBP",
    sourcePlacedAt: "2026-10-01T11:00:00.000Z",
    commerceAmountCompared: false, commerceOwnershipVerified: false,
  });
  assert.equal(Object.isFrozen(observed), true);
});

test("missing evidence is not confused with a valid marketplace-to-Commerce match", () => {
  for (const input of [{}, null, { amount: "19.99" },
    { amount: "19.99", currency: "GBP" }]) {
    const report = inspectSellerOrderSourceEvidence(input);
    assert.equal(report.state, "incomplete_source_evidence");
    assert.equal(report.commerceAmountCompared, false);
    assert.equal(report.commerceOwnershipVerified, false);
  }
});

test("invalid money, currency and timestamps cannot be presented as verified source evidence", () => {
  for (const input of [
    { amount: "-1", currency: "GBP", placedAt: "2026-01-01" },
    { amount: "1e7", currency: "GBP", placedAt: "2026-01-01" },
    { amount: "1.9999", currency: "GBP", placedAt: "2026-01-01" },
    { amount: "5.00", currency: "gbp", placedAt: "2026-01-01" },
    { amount: "5.00", currency: "US$" , placedAt: "2026-01-01" },
    { amount: "5.00", currency: "GBP", placedAt: "invalid" },
    { amount: "5.00", currency: "GBP", placedAt: 12345 },
    { amount: "5.00", currency: "GBP", placedAt: "2999-01-01T00:00:00Z" },
  ]) {
    const report = inspectSellerOrderSourceEvidence(input);
    assert.equal(report.state, "invalid_source_evidence");
    assert.equal(report.commerceOwnershipVerified, false);
  }
});

test("source financial evidence does not disclose unrelated buyer or payment metadata", () => {
  const report = inspectSellerOrderSourceEvidence({
    amount: "12.00", currency: "GBP", placedAt: new Date("2026-10-01T11:00:00Z"),
    buyerEmail: "secret@example.invalid", paymentToken: "private-secret",
  });
  assert.ok(!JSON.stringify(report).includes("secret"));
  assert.ok(!JSON.stringify(report).includes("buyerEmail"));
  assert.equal(report.state, "source_evidence_present");
});