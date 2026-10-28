import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("unified connections workspace exposes governed Google Ads and Seller Central paths", async () => {
  const page = await source("../../../frontend/src/pages/ConnectionsWorkspacePage.jsx");
  const router = await source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx");
  const navigation = await source("../../../frontend/src/components/navigation/managementNavigationConfig.js");

  assert.match(page, /key:\s*"google_ads"/);
  assert.match(page, /Google Ads \(AdWords\)/);
  assert.match(page, /key:\s*"amazon_seller_central"/);
  assert.match(page, /Amazon Seller Central/);
  assert.match(page, /<PartnerMarketplacePanel\s*\/>/);
  assert.match(page, /authorizeManagedDataConnection/);
  assert.match(page, /reconcileManagedDataConnection/);
  assert.match(page, /\/marketing\/data-connections\?type=seller/);
  assert.match(page, /\/admin\/system\/connected-accounts/);

  assert.match(router, /pathname === "\/admin\/system\/connections"/);
  assert.match(router, /<ConnectionsWorkspacePage\s*\/>/);
  assert.match(navigation, /"\/admin\/system\/connections", "Connections"/);
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
