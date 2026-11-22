import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE4 } from "../features/integrationPlatform/marketingVerifiedConnectorExtensionsWave4.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE4 } from "../features/integrationPlatform/marketingAccountVerificationExtensionsWave4.js";

test("Amazon seller connector requests seller and marketplace identity needed by adapter", () => {
  const amazon = VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE4.amazon_seller_central;
  const fields = amazon.fields.map((field) => field.key);
  for (const key of ["clientId", "region", "sellerId", "marketplaceId"]) {
    assert.ok(fields.includes(key), "Missing Amazon setup field: " + key);
    assert.equal(amazon.fields.find((field) => field.key === key).required, true);
  }
  assert.ok(amazon.credentials.every((credential) => credential.secret === true));
});

test("eBay seller connector uses an authenticated seller refresh token and read scopes", () => {
  const ebay = VERIFIED_MARKETING_CONNECTOR_EXTENSIONS_WAVE4.ebay;
  assert.ok(ebay);
  assert.equal(typeof MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE4.ebay, "function");
  assert.ok(ebay.fields.some((field) =>
    field.key === "environment" && field.required));
  assert.ok(ebay.credentials.some((field) =>
    field.role === "refresh_token" && field.required && field.secret));
  assert.ok(ebay.scopes.some((scope) => scope.endsWith("/sell.inventory.readonly")));
  assert.ok(ebay.scopes.some((scope) => scope.endsWith("/sell.fulfillment.readonly")));
});

test("eBay seller verifier uses fixed official origins and performs no external writes", async () => {
  const file = await readFile(new URL(
    "../features/integrationPlatform/marketingAccountVerificationExtensionsWave4.js",
    import.meta.url), "utf8");
  const start = file.indexOf("async function verifyEbaySeller(");
  const end = file.indexOf("async function verifyAmazonVendorCentral(", start);
  assert.ok(start > 0 && end > start);
  const verifier = file.slice(start, end);
  assert.match(verifier, /https:\/\/api\.sandbox\.ebay\.com/);
  assert.match(verifier, /https:\/\/api\.ebay\.com/);
  assert.match(verifier, /\/identity\/v1\/oauth2\/token/);
  assert.match(verifier, /\/sell\/fulfillment\/v1\/order/);
  assert.match(verifier, /writePermissionVerified: false/);
  assert.match(verifier, /merchantIdentityVerified: false/);
  assert.doesNotMatch(verifier, /bulk_update_price_quantity|shipping_fulfillment|\/publish/);
});
