import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("membership benefits use the shared immutable stored-value ledger", async () => {
  const service = await source("../features/memberships/membershipBenefitService.js");
  assert.match(service, /StoredValueInstrument/);
  assert.match(service, /StoredValueLedgerEntry/);
  assert.match(service, /buildMembershipBenefitPosting/);
  assert.match(service, /deriveStoredValueBalance/);
  assert.doesNotMatch(service, /balance\s*:\s*Schema/);
});

test("membership benefits enforce cross-location redemption policy", async () => {
  const service = await source("../features/memberships/membershipBenefitService.js");
  assert.match(service, /assertCrossLocationRedemptionAllowed/);
  assert.match(service, /crossLocationRedemptionPolicy/);
});

test("membership contract stores instrument references, not mutable benefit balances", async () => {
  const model = await source("../models/MembershipContract.js");
  assert.match(model, /benefitWallets/);
  assert.match(model, /StoredValueInstrument/);
  assert.doesNotMatch(model, /benefitBalance/);
});

test("membership routes expose benefit balances, issue and redemption", async () => {
  const routes = await source("../features/memberships/membershipRoutes.js");
  for (const path of [
    '"/contracts/:id/benefits"',
    '"/contracts/:id/benefits/issue"',
    '"/contracts/:id/benefits/:benefitKey/redeem"',
  ]) {
    assert.ok(routes.includes(path), `Missing benefit route ${path}`);
  }
});
