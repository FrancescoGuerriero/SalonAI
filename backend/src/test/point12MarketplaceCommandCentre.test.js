import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Marketplace module has a dedicated governed command-centre route", async () => {
  const page = await source("../../../frontend/src/pages/MarketplaceCommandCentrePage.jsx");
  const router = await source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx");
  const surfaces = await source("../../../frontend/src/config/aiibpModuleOperationalSurfaces.js");

  assert.match(page, /Marketplace Command Centre/);
  assert.match(router, /pathname === "\/marketplaces"/);
  assert.match(router, /<MarketplaceCommandCentrePage\s*\/>/);
  assert.match(surfaces, /key:\s*"seller-marketplace"[\s\S]*?primaryRoute:\s*"\/marketplaces"/);
});

test("Marketplace command centre exposes P0 seller providers through shared connection contracts", async () => {
  const page = await source("../../../frontend/src/pages/MarketplaceCommandCentrePage.jsx");
  const providers = await source("../../../frontend/src/config/providerConnectionRegistry.js");

  assert.match(page, /providersForModule\("seller-marketplace"\)/);
  assert.match(providers, /label:\s*"Amazon Seller Central"/);
  assert.match(providers, /label:\s*"eBay"/);
  assert.match(providers, /label:\s*"Google Merchant Center"/);
  assert.match(page, /\/admin\/system\/connections/);
  assert.match(page, /\/marketing\/data-connections\?type=seller/);
});

test("Marketplace command centre preserves canonical Commerce, Inventory, Integration and Analytics ownership", async () => {
  const page = await source("../../../frontend/src/pages/MarketplaceCommandCentrePage.jsx");

  assert.match(page, /Commerce remains the source of truth for orders, payments and refunds/);
  assert.match(page, /Inventory owns stock/);
  assert.match(page, /Integration Hub owns provider connections and credentials/);
  assert.match(page, /Analytics owns governed metrics/);
  assert.match(page, /No production marketplace write, pricing change, promotion, listing mutation or AI-initiated seller action is enabled/);
});

test("unfinished marketplace operations are visible as planned cards instead of dead navigation", async () => {
  const page = await source("../../../frontend/src/pages/MarketplaceCommandCentrePage.jsx");

  assert.match(page, /title:\s*"Returns"/);
  assert.match(page, /title:\s*"Finance"/);
  assert.match(page, /title:\s*"Pricing & promotions"/);
  assert.match(page, /Planned governed operations/);
  assert.doesNotMatch(page, /to:\s*"\/marketplace\/returns"/);
  assert.doesNotMatch(page, /to:\s*"\/marketplace\/finance"/);
});

test("Marketplace KPI presentation does not fabricate tenant performance data", async () => {
  const page = await source("../../../frontend/src/pages/MarketplaceCommandCentrePage.jsx");
  assert.match(page, /Awaiting connected data/);
});
