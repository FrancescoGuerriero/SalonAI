import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { marketingConnectedAccountCatalogue } from "../features/integrationPlatform/marketingConnectedAccountsService.js";
import { marketingAccountVerifierAvailable } from "../features/integrationPlatform/marketingAccountVerifierRegistryService.js";
import { verifiedMarketingConnectorDefinition } from "../features/integrationPlatform/marketingVerifiedConnectorsService.js";

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("provider credential storage cannot mark an account connected", async () => {
  const credentials = await source("../features/integrationPlatform/providerCredentialService.js");
  assert.match(credentials, /verificationStatus:\s*"required"/);
  assert.match(credentials, /connection\.status = "pending"/);
  assert.match(credentials, /connection\.connectedAt = null/);
  assert.doesNotMatch(credentials, /if \(connection\.status === "pending"\) connection\.status = "connected"/);
});

test("Marketing Hub exposes a provider-specific live verification boundary", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationService.js");
  const controller = await source("../features/integrationPlatform/marketingConnectedAccountsController.js");
  const routes = await source("../features/integrationPlatform/marketingConnectedAccountsRoutes.js");

  assert.match(verification, /MARKETING_PROVIDER_VERIFICATION_FAILED/);
  assert.match(verification, /verificationStatus:\s*"verified"/);
  assert.match(verification, /verificationStatus:\s*"failed"/);
  assert.match(verification, /connection\.status = "connected"/);
  assert.match(verification, /connection\.status = "pending"/);

  assert.match(controller, /marketingAccountVerifierAvailable/);
  assert.match(controller, /verifyMarketingConnectedAccount/);
  assert.match(controller, /MARKETING_PROVIDER_VERIFIER_NOT_AVAILABLE/);
  assert.match(controller, /verification\.verified && account\?\.connectionId && supportsIngestion/);
  assert.match(routes, /\/accounts\/:provider\/verify/);
});

test("verified expanded connectors have real credential schemas and official verification calls", async () => {
  const definitions = await source("../features/integrationPlatform/marketingVerifiedConnectorsService.js");
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationService.js");

  for (const provider of ["github", "gitlab", "openai_ads", "paypal_transactions", "sendgrid", "square", "twilio"]) {
    assert.match(definitions, new RegExp(`${provider}:`));
    assert.match(verification, new RegExp(`${provider}:`));
  }

  assert.match(verification, /https:\/\/api\.ads\.openai\.com\/v1\/ad_account/);
  assert.match(verification, /https:\/\/api\.github\.com\/user/);
  assert.match(verification, /https:\/\/gitlab\.com\/api\/v4\/user/);
  assert.match(verification, /https:\/\/api\.sendgrid\.com\/v3\/user\/profile/);
  assert.match(verification, /https:\/\/connect\.squareup\.com\/v2\/locations/);
  assert.match(verification, /https:\/\/api\.twilio\.com\/2010-04-01\/Accounts/);
  assert.match(verification, /\/v1\/oauth2\/token/);
});

test("major existing marketing connectors also require live account verification", async () => {
  const verification = await source("../features/integrationPlatform/marketingAccountVerificationService.js");
  for (const provider of [
    "google_ads",
    "ga4",
    "google_search_console",
    "google_business_profile",
    "youtube_analytics",
    "meta_ads",
    "facebook_pages",
    "instagram_organic",
    "linkedin_ads",
    "linkedin_pages",
    "tiktok_ads",
    "mailchimp",
    "stripe",
    "shopify",
    "hubspot",
  ]) {
    assert.match(verification, new RegExp(`${provider}:`), `missing verifier ${provider}`);
  }
  assert.match(verification, /GOOGLE_ADS_API_VERSION = "v26"/);
  assert.match(verification, /META_GRAPH_VERSION = "v26\.0"/);
  assert.match(verification, /SHOPIFY_API_VERSION = "2026-10"/);
});

test("Wave 10 Exchange Rates and Mixpanel are credential-backed verified connectors", async () => {
  const verifier = await source("../features/integrationPlatform/marketingAccountVerificationExtensionsWave10.js");

  for (const provider of ["exchange_rates", "mixpanel"]) {
    const definition = verifiedMarketingConnectorDefinition(provider);
    assert.ok(definition, `missing verified connector definition for ${provider}`);
    assert.equal(marketingAccountVerifierAvailable(provider), true, `missing live verifier for ${provider}`);
    assert.ok(definition.credentials.length > 0, `${provider} must require real credentials`);
  }

  const exchangeRates = verifiedMarketingConnectorDefinition("exchange_rates");
  assert.ok(exchangeRates.credentials.some((item) => item.role === "api_key" && item.required));
  assert.match(exchangeRates.documentationUrl, /openexchangerates/i);

  const mixpanel = verifiedMarketingConnectorDefinition("mixpanel");
  assert.ok(mixpanel.fields.some((item) => item.key === "serviceAccountUsername" && item.required));
  assert.ok(mixpanel.fields.some((item) => item.key === "projectId" && item.required));
  assert.ok(mixpanel.credentials.some((item) => item.role === "password" && item.required));

  assert.match(verifier, /https:\/\/openexchangerates\.org\/api\/latest\.json/);
  assert.match(verifier, /authorization:\s*`Token \$\{appId\}`/);
  assert.match(verifier, /MIXPANEL_REGION_HOSTS/);
  assert.match(verifier, /US:\s*"mixpanel\.com"/);
  assert.match(verifier, /EU:\s*"eu\.mixpanel\.com"/);
  assert.match(verifier, /IN:\s*"in\.mixpanel\.com"/);
  assert.match(verifier, /\/api\/app\/me/);
  assert.match(verifier, /MARKETING_PROVIDER_PROJECT_ACCESS_NOT_VERIFIED/);
  assert.match(verifier, /redirect:\s*"error"/);
});

test("every catalogue provider exposed as configurable has a registered account verifier", () => {
  const catalogue = marketingConnectedAccountCatalogue();
  for (const item of catalogue.items) {
    if (item.configurable === false) continue;
    assert.equal(
      marketingAccountVerifierAvailable(item.provider),
      true,
      `${item.provider} is configurable but has no registered live verifier`
    );
  }
});

test("sources without an honest connector remain visible but cannot accept credentials", () => {
  const catalogue = marketingConnectedAccountCatalogue();
  const byProvider = new Map(catalogue.items.map((item) => [item.provider, item]));

  for (const provider of ["mysql", "quora_ads", "shopee_ads", "yahoo_finance_price"]) {
    const item = byProvider.get(provider);
    assert.ok(item, `${provider} must remain visible in the requested inventory`);
    assert.equal(item.configurable, false, `${provider} must not expose a fake Connect flow`);
    assert.equal(item.ready, false, `${provider} must not claim readiness without verification`);
    assert.equal(marketingAccountVerifierAvailable(provider), false, `${provider} unexpectedly has a verifier`);
    assert.equal(verifiedMarketingConnectorDefinition(provider), null, `${provider} unexpectedly has a verified connector definition`);
  }
});

test("account connection and ingestion readiness are separate governance states", async () => {
  const controller = await source("../features/integrationPlatform/marketingConnectedAccountsController.js");
  const catalogue = await source("../features/integrationPlatform/marketingConnectorCatalogue.js");

  assert.match(controller, /ingestionAdapterAvailable/);
  assert.match(controller, /account_connected_adapter_pending/);
  assert.match(controller, /dataHubSourceStatus/);
  assert.match(catalogue, /liveActivation:\s*"catalogue_only"/);
});

test("frontend exposes verification-aware account connection workflow", async () => {
  const client = await source("../../../frontend/src/Services/marketingConnectionsService.js");
  const page = await source("../../../frontend/src/pages/MarketingHubPage.jsx");

  assert.match(client, /verifyMarketingAccount/);
  assert.match(client, /\/verify/);
  assert.match(page, /configurable/);
  assert.match(page, /readiness/);
});
