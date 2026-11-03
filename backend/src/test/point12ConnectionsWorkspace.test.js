import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("unified connections workspace uses the reusable provider directory", async () => {
  const page = await source("../../../frontend/src/pages/ConnectionsWorkspacePage.jsx");
  const directory = await source("../../../frontend/src/components/integrations/ProviderConnectionDirectory.jsx");
  const registry = await source("../../../frontend/src/config/providerConnectionRegistry.js");
  const service = await source("../../../frontend/src/Services/marketingConnectionsService.js");
  const router = await source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx");
  const navigation = await source("../../../frontend/src/components/navigation/managementNavigationConfig.js");

  assert.match(page, /<ProviderConnectionDirectory/);
  assert.match(page, /getManagedDataConnectionCatalogue/);
  assert.match(page, /getMarketingAccounts/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /\/marketing\/data-connections\?type=seller/);
  assert.match(page, /\/admin\/system\/connected-accounts/);
  assert.match(page, /<PartnerMarketplacePanel\s*\/>/);

  for (const provider of [
    "google_ads",
    "facebook",
    "microsoft_ads",
    "apple_search_ads",
    "ga4",
    "google_tag_manager",
    "google_search_console",
    "bing_webmaster",
    "sendgrid",
    "twilio",
    "amazon_sp",
    "ebay",
    "google_merchant_center",
    "quickbooks",
    "xero",
    "stripe",
  ]) {
    assert.match(registry, new RegExp(`key:\\s*"${provider}"`));
  }

  assert.match(directory, /PROVIDER_CONNECTION_CATEGORIES/);
  assert.match(directory, /PROVIDER_AUTH_MODES\.OAUTH/);
  assert.match(directory, /PROVIDER_AUTH_MODES\.API_CREDENTIALS/);
  assert.match(directory, /authorizeManagedDataConnection/);
  assert.match(directory, /configureMarketingAccount/);
  assert.match(directory, /verifyMarketingAccount/);
  assert.match(directory, /type="password"/);
  assert.match(directory, /Secrets are submitted to the protected backend/);
  assert.match(directory, /does not ask for a Google, Meta, Microsoft, Amazon or eBay password/);
  assert.match(directory, /max-h-\[calc\(100vh-1\.5rem\)\]/);

  assert.match(service, /API\.put\(`\$\{BASE_URL\}\/accounts\/\$\{encodeURIComponent\(provider\)\}`/);
  assert.match(router, /pathname === "\/admin\/system\/connections"/);
  assert.match(router, /<ConnectionsWorkspacePage\s*\/>/);
  assert.match(navigation, /"\/admin\/system\/connections", "Connections"/);
});

test("provider credential routes remain verified, server-side and permission protected", async () => {
  const routes = await source("../features/integrationPlatform/marketingConnectedAccountsRoutes.js");
  const controller = await source("../features/integrationPlatform/marketingConnectedAccountsController.js");
  const verified = await source("../features/integrationPlatform/marketingVerifiedConnectorsService.js");

  assert.match(routes, /requirePermissions\("feature-control:update"\)/);
  assert.match(routes, /router\.put\("\/accounts\/:provider", write/);
  assert.match(controller, /verifyMarketingConnectedAccount/);
  assert.match(controller, /Provider credentials were not persisted for verification/);
  assert.match(verified, /storeProviderCredential/);
  assert.match(verified, /verificationStatus:\s*"required"/);
  assert.match(verified, /liveSyncEnabled:\s*false/);
  assert.doesNotMatch(verified, /password\s*:/i);
});

test("customer chatbot remains front-end integrated and enabled by default", async () => {
  const layout = await source("../../../frontend/src/components/MainLayout.jsx");
  const backendFeatureControls = await source("../services/featureControlService.js");
  const backendApp = await source("../app.js");

  assert.match(layout, /isFeatureEnabled\("salon-chatbot"\)/);
  assert.match(layout, /<SalonChatbot\s*\/>/);
  assert.match(
    backendFeatureControls,
    /id:\s*"salon-chatbot"[\s\S]*?defaultEnabled:\s*true/
  );
  assert.match(backendApp, /requireFeature\("salon-chatbot"\)/);
});
