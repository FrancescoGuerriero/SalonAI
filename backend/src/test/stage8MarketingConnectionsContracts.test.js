import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { marketingConnectedAccountCatalogue } from "../features/integrationPlatform/marketingConnectedAccountsService.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Stage 8 Marketing catalogue exposes all governed provider connection forms", () => {
  const catalogue = marketingConnectedAccountCatalogue();
  const providers = new Map(catalogue.items.map((item) => [item.provider, item]));
  const expected = [
    "google_ads", "meta_ads", "linkedin_ads", "microsoft_ads", "tiktok_ads",
    "facebook_pages", "instagram_organic", "linkedin_pages", "google_business_profile",
    "ga4", "google_search_console", "shopify", "stripe", "hubspot", "mailchimp",
    "youtube_analytics",
  ];
  for (const key of expected) assert.ok(providers.has(key), `missing ${key}`);
  assert.equal(providers.get("google_ads").credentials.find((item) => item.key === "developerToken")?.role, "api_key");
  assert.equal(providers.get("meta_ads").credentials.find((item) => item.key === "appSecret")?.role, "client_secret");
  assert.equal(providers.get("shopify").credentials.find((item) => item.key === "accessToken")?.role, "access_token");
  assert.equal(providers.get("stripe").credentials.find((item) => item.key === "apiKey")?.role, "api_key");
  assert.equal(catalogue.liveSyncEnabled, false);
});

test("Marketing connection service uses the shared provider credential authority", async () => {
  const service = await source("../features/integrationPlatform/marketingConnectedAccountsService.js");
  assert.match(service, /storeProviderCredential/);
  assert.match(service, /CredentialVersion/);
  assert.match(service, /credentialBindings/);
  assert.match(service, /liveSyncEnabled: false/);
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
  assert.match(integrationRoutes, /"\/marketing-connections"/);
  assert.match(controller, /effectiveAuthority\?\.businessId/);
  assert.match(controller, /tenantContext\?\.businessId/);
});

test("Marketing dashboard is routed and visible from canonical management navigation", async () => {
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
  assert.match(client, /\/integration-platform\/marketing-connections/);
});

test("Marketing provider forms include key account identifiers and provider guidance", async () => {
  const service = await source("../features/integrationPlatform/marketingConnectedAccountsService.js");
  assert.match(service, /documentationUrl/);
  assert.match(service, /Google Ads customer ID/);
  assert.match(service, /Meta App ID/);
  assert.match(service, /Ad account URN/);
  assert.match(service, /Advertiser ID/);
  assert.match(service, /Shop domain/);
  assert.match(service, /Stripe account ID/);
  assert.match(service, /server prefix/);
  assert.match(service, /YouTube channel ID/);
});
