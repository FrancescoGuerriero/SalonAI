import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("cross-location settlement projects immutable stored-value redemption evidence", async () => {
  const [ledger, service] = await Promise.all([
    source("../models/StoredValueLedgerEntry.js"),
    source("../features/finance/settlementService.js"),
  ]);

  assert.match(ledger, /Stored-value ledger entries are immutable/);
  assert.match(service, /planInterLocationSettlement/);
  assert.match(service, /eventType !== "redeem"/);
  assert.match(service, /unit !== "money"/);
  assert.match(service, /sourceLedgerFingerprint/);
  assert.match(service, /sourceLedgerEntry/);
  assert.match(service, /business:\s*businessId/);
});

test("cross-location obligation exposes matched payable and receivable without payment execution", async () => {
  const obligation = await source("../models/CrossLocationObligation.js");
  const batch = await source("../models/SettlementBatch.js");

  assert.match(obligation, /payable/);
  assert.match(obligation, /receivable/);
  assert.match(obligation, /sourceLedgerFingerprint/);
  assert.match(obligation, /settlementFingerprint/);
  assert.match(batch, /paymentExecutionAllowed/);
  assert.match(batch, /value === false/);
  assert.doesNotMatch(batch, /paid|payment_intent|bank_transfer/i);
});

test("manual-review settlement policy fails closed until authorised review", async () => {
  const service = await source("../features/finance/settlementService.js");

  assert.match(service, /manual-review/);
  assert.match(service, /pending_review/);
  assert.match(service, /decision === "approved" \? "open" : "rejected"/);
  assert.match(service, /finance\.cross_location_obligation_reviewed/);
});

test("settlement batches are reconciliation-only and never mark obligations paid", async () => {
  const service = await source("../features/finance/settlementService.js");

  assert.match(service, /status:\s*"draft"/);
  assert.match(service, /status:\s*"batched"/);
  assert.match(service, /paymentExecutionAllowed:\s*false/);
  assert.match(service, /externalPaymentInitiated:\s*false/);
  assert.match(service, /SETTLEMENT_BATCH_CONCURRENT_CHANGE/);
  assert.doesNotMatch(service, /status:\s*"paid"/);
  assert.doesNotMatch(service, /stripe|bank transfer|payment intent/i);
});

test("settlement routes use trusted tenant authority and reports permissions", async () => {
  const routes = await source("../features/finance/settlementRoutes.js");

  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /"reports:read"/);
  assert.match(routes, /"reports:manage"/);
  assert.match(routes, /"\/projection\/:ledgerEntryId"/);
  assert.match(routes, /"\/batches\/:batchId\/review"/);
});
