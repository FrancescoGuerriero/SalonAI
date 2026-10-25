import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE5 } from "../features/integrationPlatform/marketingVerifiedConnectorExtensionsWave5.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE5 } from "../features/integrationPlatform/marketingAccountVerificationExtensionsWave5.js";

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

const expected = [
  "google_ad_manager",
  "google_bigquery",
  "google_campaign_manager_360",
  "google_display_video_360",
  "google_merchant_center",
  "google_search_ads_360",
  "google_sheets",
  "google_pagespeed_insights",
  "google_webfonts",
];

test("Google enterprise/data wave has real schemas and verifiers", () => {
  for (const provider of expected) {
    assert.ok(VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE5[provider], `missing definition ${provider}`);
    assert.equal(typeof MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE5[provider], "function", `missing verifier ${provider}`);
  }
});

test("Google enterprise verifiers use current stable/account endpoints", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave5.js");
  assert.match(verification, /admanager\.googleapis\.com\/v1\/networks/);
  assert.match(verification, /bigquery\.googleapis\.com\/bigquery\/v2\/projects/);
  assert.match(verification, /dfareporting\.googleapis\.com\/dfareporting\/v5\/userprofiles/);
  assert.match(verification, /displayvideo\.googleapis\.com\/v4\/advertisers/);
  assert.match(verification, /merchantapi\.googleapis\.com\/accounts\/v1\/accounts/);
  assert.match(verification, /searchads360\.googleapis\.com\/v0\/customers/);
  assert.match(verification, /sheets\.googleapis\.com\/v4\/spreadsheets/);
});

test("Google key-based public APIs are still credential verified", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave5.js");
  assert.match(verification, /pagespeedonline\/v5\/runPagespeed/);
  assert.match(verification, /webfonts\/v1\/webfonts/);
  const pageSpeed = VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE5.google_pagespeed_insights;
  const webfonts = VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE5.google_webfonts;
  assert.equal(pageSpeed.credentials[0].role, "api_key");
  assert.equal(webfonts.credentials[0].role, "api_key");
});

test("Google OAuth refresh stays inside encrypted provider credential authority", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave5.js");
  assert.match(verification, /https:\/\/oauth2\.googleapis\.com\/token/);
  assert.match(verification, /storeProviderCredential/);
  assert.match(verification, /role:\s*"access_token"/);
});
