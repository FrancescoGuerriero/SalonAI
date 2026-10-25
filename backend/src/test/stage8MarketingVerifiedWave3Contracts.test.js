import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE3 } from "../features/integrationPlatform/marketingVerifiedConnectorExtensionsWave3.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE3 } from "../features/integrationPlatform/marketingAccountVerificationExtensionsWave3.js";

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

const expected = [
  "quickbooks",
  "xero",
  "zoho_crm",
  "mailersend",
  "surveymonkey",
  "rocket_chat",
  "microsoft_teams",
  "microsoft_dataverse",
  "microsoft_dynamics_365",
];

test("finance CRM and communications wave has real schemas and verifiers", () => {
  for (const provider of expected) {
    assert.ok(VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE3[provider], `missing definition ${provider}`);
    assert.equal(typeof MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE3[provider], "function", `missing verifier ${provider}`);
  }
});

test("wave 3 verifies official account and organization surfaces", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave3.js");
  assert.match(verification, /quickbooks\.api\.intuit\.com/);
  assert.match(verification, /api\.xero\.com\/connections/);
  assert.match(verification, /identity\.xero\.com\/connect\/token/);
  assert.match(verification, /\/crm\/v8\/org/);
  assert.match(verification, /api\.mailersend\.com\/v1\/domains/);
  assert.match(verification, /api\.surveymonkey\.com\/v3\/users\/me/);
  assert.match(verification, /\/api\/v1\/me/);
  assert.match(verification, /graph\.microsoft\.com\/v1\.0\/me/);
  assert.match(verification, /\/api\/data\/v9\.2\/WhoAmI/);
});

test("self-hosted Rocket.Chat verification rejects private network origins", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave3.js");
  assert.match(verification, /dns\.lookup/);
  assert.match(verification, /privateIp/);
  assert.match(verification, /MARKETING_PROVIDER_ORIGIN_REJECTED/);
  assert.match(verification, /parsed\.protocol !== "https:"/);
});

test("Xero and Zoho refresh expiring OAuth access tokens through encrypted credential authority", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave3.js");
  assert.match(verification, /storeProviderCredential/);
  assert.match(verification, /role:\s*"access_token"/);
  assert.match(verification, /role:\s*"refresh_token"/);
  assert.match(verification, /refreshedBy:\s*"xero_verification"/);
  assert.match(verification, /refreshedBy:\s*"zoho_crm_verification"/);
});
