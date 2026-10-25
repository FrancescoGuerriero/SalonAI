import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { VERIFIED_MARKETING_CONNECTOR_EXTENSIONS } from "../features/integrationPlatform/marketingVerifiedConnectorExtensions.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS } from "../features/integrationPlatform/marketingAccountVerificationExtensions.js";

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

const expected = [
  "pinterest_ads",
  "pinterest_organic",
  "slack",
  "zoom",
  "spotify_ads",
  "salesforce",
];

test("second verified connector wave has credential schemas and live verifiers", () => {
  for (const provider of expected) {
    assert.ok(VERIFIED_MARKETING_CONNECTOR_EXTENSIONS[provider], `missing connector definition ${provider}`);
    assert.equal(typeof MARKETING_ACCOUNT_VERIFIER_EXTENSIONS[provider], "function", `missing verifier ${provider}`);
    assert.ok(VERIFIED_MARKETING_CONNECTOR_EXTENSIONS[provider].credentials.length > 0, `${provider} needs credentials`);
  }
});

test("extension verifiers use official read-only identity/account surfaces", async () => {
  const sourceText = await source("../features/integrationPlatform/marketingAccountVerificationExtensions.js");
  assert.match(sourceText, /https:\/\/api\.pinterest\.com\/v5\/user_account/);
  assert.match(sourceText, /https:\/\/slack\.com\/api\/auth\.test/);
  assert.match(sourceText, /https:\/\/zoom\.us\/oauth\/token/);
  assert.match(sourceText, /https:\/\/api\.zoom\.us\/v2\/users\/me/);
  assert.match(sourceText, /https:\/\/api-partner\.spotify\.com\/ads\/v3\/businesses/);
  assert.match(sourceText, /\/services\/oauth2\/userinfo/);
  assert.match(sourceText, /MARKETING_PROVIDER_ORIGIN_REJECTED/);
});

test("unified verifier registry combines core and extension providers", async () => {
  const registry = await source("../features/integrationPlatform/marketingAccountVerifierRegistryService.js");
  const controller = await source("../features/integrationPlatform/marketingConnectedAccountsController.js");
  assert.match(registry, /coreVerifierAvailable/);
  assert.match(registry, /MARKETING_ACCOUNT_VERIFIER_EXTENSIONS/);
  assert.match(registry, /verificationStatus:\s*"verified"/);
  assert.match(registry, /verificationStatus:\s*"failed"/);
  assert.match(controller, /marketingAccountVerifierRegistryService/);
});

test("credential authority supports provider-specific secret roles without exposing them", async () => {
  const connection = await source("../models/IntegrationConnection.js");
  const credentials = await source("../features/integrationPlatform/providerCredentialService.js");
  for (const role of ["access_token_secret", "consumer_secret", "secret_access_key", "session_token", "private_key", "signing_key", "password", "service_account_json"]) {
    assert.match(connection, new RegExp(`"${role}"`));
    assert.match(credentials, new RegExp(`${role}:`));
  }
  assert.match(credentials, /delete value\.secretCiphertext/);
  assert.match(credentials, /delete value\.secretIv/);
  assert.match(credentials, /delete value\.secretTag/);
});
