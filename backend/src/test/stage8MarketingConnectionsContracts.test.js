import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { marketingConnectedAccountCatalogue } from "../features/integrationPlatform/marketingConnectedAccountsService.js";
import { marketingConnectorCatalogue } from "../features/integrationPlatform/marketingConnectorCatalogue.js";
import { MARKETING_HUB_PROVIDER_EXTENSIONS } from "../features/integrationPlatform/marketingHubProviderExtensions.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

const implementedProviders = [
  "google_ads", "meta_ads", "linkedin_ads", "microsoft_ads", "tiktok_ads",
  "facebook_pages", "instagram_organic", "linkedin_pages", "google_business_profile",
  "ga4", "google_search_console", "bing_webmaster", "shopify", "stripe", "hubspot", "mailchimp",
  "youtube_analytics",
];

test("Stage 8 Marketing catalogue exposes implemented and roadmap providers", () => {
  const catalogue = marketingConnectedAccountCatalogue();
  const providers = new Map(catalogue.items.map((item) => [item.provider, item]));
  for (const key of implementedProviders) assert.ok(providers.has(key), `missing implemented provider ${key}`);
  for (const item of MARKETING_HUB_PROVIDER_EXTENSIONS) assert.ok(providers.has(item.key), `missing roadmap provider ${item.key}`);
  assert.equal(providers.size, implementedProviders.length + MARKETING_HUB_PROVIDER_EXTENSIONS.length);

  assert.equal(providers.get("google_ads").credentials.find((item) => item.key === "developerToken")?.role, "api_key");
  assert.equal(providers.get("meta_ads").credentials.find((item) => item.key === "appSecret")?.role, "client_secret");
  assert.equal(providers.get("shopify").credentials.find((item) => item.key === "accessToken")?.role, "access_token");
  assert.equal(providers.get("stripe").credentials.find((item) => item.key === "apiKey")?.role, "api_key");
  assert.equal(providers.get("bing_webmaster").credentials.find((item) => item.key === "refreshToken")?.role, "refresh_token");
  assert.ok(providers.get("hubspot").scopes.includes("content"));

  for (const item of MARKETING_HUB_PROVIDER_EXTENSIONS) {
    assert.equal(providers.get(item.key).configurable, false, `${item.key} remains disabled in the legacy catalogue until the verification-aware controller promotes a real connector`);
    assert.equal(providers.get(item.key).ready, false, `${item.key} must not report ready before verified connection`);
    assert.equal(providers.get(item.key).liveSyncEnabled, false);
  }
  assert.equal(providers.get("openai_ads").documentationUrl, "https://developers.openai.com/ads/api-reference/authentication");
  assert.equal(providers.get("openai_ads").implementationStatus, "planned");
  assert.equal(catalogue.liveSyncEnabled, false);
  assert.equal(catalogue.version, "1.1.0");
});

test("Marketing source catalogue distinguishes implemented adapters from catalogue-only roadmap entries", () => {
  const catalogue = marketingConnectorCatalogue();
  const byKey = new Map(catalogue.connectors.map((item) => [item.key, item]));
  for (const key of ["google_ads", "meta_ads", "linkedin_ads", "microsoft_ads", "tiktok_ads", "shopify", "stripe", "hubspot", "mailchimp", "youtube_analytics"]) {
    assert.ok(byKey.has(key), `missing source contract ${key}`);
    assert.equal(byKey.get(key).liveActivation, "adapter_pending_acceptance");
    assert.ok(byKey.get(key).defaultFields.length > 0);
  }
  for (const item of MARKETING_HUB_PROVIDER_EXTENSIONS) {
    assert.ok(byKey.has(item.key), `missing roadmap connector ${item.key}`);
    assert.equal(byKey.get(item.key).liveActivation, "catalogue_only");
    assert.equal(byKey.get(item.key).configurable, false);
    assert.equal(byKey.get(item.key).defaultFields.length, 0);
  }
  assert.ok(byKey.has("bing_webmaster"));
  assert.ok(byKey.get("hubspot").requiredScopes.includes("content"));
  assert.equal(catalogue.version, "2.1.0");
});

test("Marketing connection service uses the shared provider credential authority and blocks catalogue-only configuration", async () => {
  const service = await source("../features/integrationPlatform/marketingConnectedAccountsService.js");
  assert.match(service, /storeProviderCredential/);
  assert.match(service, /CredentialVersion/);
  assert.match(service, /credentialBindings/);
  assert.match(service, /liveSyncEnabled: false/);
  assert.match(service, /MARKETING_PROVIDER_NOT_YET_IMPLEMENTED/);
  assert.match(service, /definition\.configurable/);
});

test("Marketing connections API is permission protected and mounted under Integration Platform", async () => {
  const [routes, integrationRoutes, controller] = await Promise.all([
    source("../features/integrationPlatform/marketingConnectedAccountsRoutes.js"),
    source("../features/integrationPlatform/integrationPlatformRoutes.js"),
    source("../features/integrationPlatform/marketingConnectedAccountsController.js"),
  ]);
  assert.match(routes, /feature-control:read/);
  assert.match(routes, /feature-control:update/);
  assert.match(routes, /\/accounts\/:provider/);
  assert.match(routes, /\/accounts\/:provider\/verify/);
  assert.match(integrationRoutes, /"\/marketing-connections"/);
  assert.match(controller, /effectiveAuthority\?\.businessId/);
  assert.match(controller, /tenantContext\?\.businessId/);
  assert.match(controller, /ensureMarketingSourceForConnection/);
  assert.match(controller, /pauseMarketingSourceForProvider/);
  assert.match(controller, /verifyMarketingConnectedAccount/);
});

test("Marketing source provisioning stays ready-only, bridges routing metadata, and keeps execution locked", async () => {
  const [provisioning, providerRun] = await Promise.all([
    source("../features/integrationPlatform/marketingSourceProvisioningService.js"),
    source("../features/integrationPlatform/marketingProviderRunService.js"),
  ]);
  assert.match(provisioning, /status: "ready"/);
  assert.match(provisioning, /syncMode: "manual"/);
  assert.match(provisioning, /liveProviderExecution: false/);
  assert.match(provisioning, /ROUTING_FIELDS/);
  assert.match(provisioning, /propertyId/);
  assert.match(provisioning, /siteUrl/);
  assert.match(provisioning, /shopDomain/);
  assert.match(provisioning, /oauthClientId/);
  assert.match(provisioning, /status: "paused"/);
  assert.match(providerRun, /source\.sourceConfig\?\.liveProviderExecution === false/);
  assert.match(providerRun, /MARKETING_PROVIDER_EXECUTION_NOT_AUTHORISED/);
});

test("Marketing dashboard is routed, displays unavailable providers safely, and is visible from canonical management navigation", async () => {
  const [page, router, navigation, client] = await Promise.all([
    source("../../../frontend/src/pages/MarketingHubPage.jsx"),
    source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx"),
    source("../../../frontend/src/components/navigation/managementNavigationConfig.js"),
    source("../../../frontend/src/Services/marketingConnectionsService.js"),
  ]);
  assert.match(router, /pathname === "\/marketing"/);
  assert.match(navigation, /\["\/marketing", "Marketing"/);
  assert.match(page, /Marketing connections/);
  assert.match(page, /Data Hub/);
  assert.match(page, /Planned provider connectors/);
  assert.match(page, /account\.configurable === false/);
  assert.match(page, /Included in the Marketing Hub roadmap/);
  assert.match(client, /\/integration-platform\/marketing-connections/);
  assert.match(client, /verifyMarketingAccount/);
});

test("Marketing provider forms include key account identifiers and provider guidance", async () => {
  const service = await source("../features/integrationPlatform/marketingConnectedAccountsService.js");
  assert.match(service, /documentationUrl/);
  assert.match(service, /Google Ads customer ID/);
  assert.match(service, /Meta App ID/);
  assert.match(service, /Ad account URN/);
  assert.match(service, /Advertiser ID/);
  assert.match(service, /Bing Webmaster site URL/);
  assert.match(service, /Shop domain/);
  assert.match(service, /Stripe account ID/);
  assert.match(service, /server prefix/);
  assert.match(service, /YouTube channel ID/);
});