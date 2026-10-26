import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE4 } from "../features/integrationPlatform/marketingVerifiedConnectorExtensionsWave4.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE4 } from "../features/integrationPlatform/marketingAccountVerificationExtensionsWave4.js";

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

const expected = [
  "amazon_ads",
  "amazon_dsp",
  "amazon_seller_central",
  "amazon_vendor_central",
  "amazon_sqs",
  "apple_search_ads",
];

test("Amazon and Apple wave has real schemas and verifier functions", () => {
  for (const provider of expected) {
    assert.ok(VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE4[provider], `missing definition ${provider}`);
    assert.equal(typeof MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE4[provider], "function", `missing verifier ${provider}`);
  }
});

test("Amazon Ads uses LWA and live advertiser profiles", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave4.js");
  assert.match(verification, /https:\/\/api\.amazon\.com\/auth\/o2\/token/);
  assert.match(verification, /\/v2\/profiles/);
  assert.match(verification, /Amazon-Advertising-API-ClientId/);
  assert.match(verification, /advertising-api-eu\.amazon\.com/);
});

test("Amazon SP connectors use current LWA SP-API authorization boundary", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave4.js");
  assert.match(verification, /sellingpartnerapi-eu\.amazon\.com/);
  assert.match(verification, /x-amz-access-token/);
  assert.match(verification, /\/sellers\/v1\/marketplaceParticipations/);
  assert.match(verification, /\/vendor\/orders\/v1\/purchaseOrders/);
  assert.match(verification, /createdAfter/);
  assert.match(verification, /createdBefore/);
});

test("Amazon SQS verifier performs SigV4 signed ListQueues", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave4.js");
  assert.match(verification, /AmazonSQS\.ListQueues/);
  assert.match(verification, /AWS4-HMAC-SHA256/);
  assert.match(verification, /secret_access_key/);
  assert.match(verification, /x-amz-security-token/);
  assert.match(verification, /sqs\.\$\{region\}\.amazonaws\.com/);
});

test("Apple Ads schema stores the private key securely and verifier creates ES256 credentials", async () => {
  const definition = VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE4.apple_search_ads;
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave4.js");

  assert.ok(definition.credentials.some((item) => item.role === "private_key" && item.required));
  assert.match(verification, /credential\(connection, "private_key"\)/);
  assert.match(verification, /alg:\s*"ES256"/);
  assert.match(verification, /dsaEncoding:\s*"ieee-p1363"/);
  assert.match(verification, /https:\/\/appleid\.apple\.com\/auth\/oauth2\/token/);
  assert.match(verification, /scope:\s*"searchadsorg"/);
  assert.match(verification, /https:\/\/api\.ads\.apple\.com\/v1\/me/);
});
