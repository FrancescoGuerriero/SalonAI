import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listWindsorMarketingConnectors,
  windsorMarketingConnector,
} from "../features/integrationPlatform/windsorConnectorCatalogue.js";
import {
  listWindsorFieldProfiles,
  resolveWindsorFieldProfile,
} from "../features/integrationPlatform/windsorFieldProfiles.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = (relative) => fs.readFile(path.resolve(here, relative), "utf8");

test("Point 12 Windsor catalogue includes requested seller connections", () => {
  const sellers = listWindsorMarketingConnectors({ kind: "seller" });
  const keys = new Set(sellers.map(({ key }) => key));
  assert.ok(keys.has("amazon_sp"));
  assert.ok(keys.has("ebay"));
  assert.equal(windsorMarketingConnector("amazon_sp").category, "Sellers");
  assert.equal(windsorMarketingConnector("ebay").category, "Sellers");
});

test("Windsor catalogue separates sources, sellers and destinations", () => {
  assert.equal(windsorMarketingConnector("chatgpt").kind, "ai-destination");
  assert.equal(windsorMarketingConnector("claude").kind, "ai-destination");
  assert.equal(windsorMarketingConnector("copilot_agent").kind, "ai-destination");
  assert.equal(windsorMarketingConnector("power_bi").kind, "destination");
  assert.equal(windsorMarketingConnector("amazon_redshift").kind, "data-platform");
  assert.equal(windsorMarketingConnector("google_ads").kind, "source");
  assert.equal(windsorMarketingConnector("amazon_sp").kind, "seller");
});

test("requested Windsor catalogue is broad and metadata-driven", () => {
  const all = listWindsorMarketingConnectors();
  assert.ok(all.length >= 85, `expected at least 85 requested connectors, found ${all.length}`);
  assert.ok(all.every((item) => item.key && item.label && item.category && item.kind));
  assert.equal(new Set(all.map(({ key }) => key)).size, all.length);
});

test("Amazon and eBay seller profiles provide curated fields and KPIs", () => {
  const amazon = listWindsorFieldProfiles("amazon_sp");
  const ebay = listWindsorFieldProfiles("ebay");
  assert.ok(amazon.some((profile) => profile.key === "orders" && profile.isDefault));
  assert.ok(amazon.some((profile) => profile.key === "inventory"));
  assert.ok(ebay.some((profile) => profile.key === "orders" && profile.isDefault));
  assert.ok(ebay.some((profile) => profile.key === "traffic"));
  assert.ok(ebay.some((profile) => profile.key === "promotedListings"));
  assert.ok(resolveWindsorFieldProfile("amazon_sp", "orders").fields.includes("flat_file_all_orders_data_by_last_update_general__item_price"));
  assert.ok(resolveWindsorFieldProfile("ebay", "orders").fields.includes("order_total"));
});

test("Windsor service keeps API key server-side and uses documented query parameters", async () => {
  const service = await source("../features/integrationPlatform/windsorConnectorService.js");
  assert.match(service, /process\.env\.WINDSOR_API_KEY/);
  assert.match(service, /MAX_PREVIEW_ROWS\s*=\s*100/);
  assert.match(service, /WINDSOR_CONNECTOR_IS_DESTINATION/);
  assert.match(service, /WINDSOR_AUTHORIZATION_SESSION_REQUIRED/);
  assert.match(service, /searchParams\.set\("select_accounts", account\)/);
  assert.match(service, /searchParams\.set\("_max_rows"/);
  assert.match(service, /searchParams\.set\("date_from"/);
  assert.match(service, /searchParams\.set\("date_to"/);
  assert.match(service, /searchParams\.set\("refresh_since"/);
  assert.match(service, /searchParams\.set\("refresh_interval"/);
  assert.match(service, /\/options/);
  assert.doesNotMatch(service, /searchParams\.set\("account_id", account\)/);
  assert.doesNotMatch(service, /searchParams\.set\("limit",/);
});

test("Windsor controller enforces account and source ownership", async () => {
  const controller = await source("../features/integrationPlatform/windsorConnectorController.js");
  assert.match(controller, /request\.effectiveAuthority\?\.businessId/);
  assert.match(controller, /WINDSOR_ACCOUNT_NOT_OWNED_BY_BUSINESS/);
  assert.match(controller, /WINDSOR_SOURCE_NOT_OWNED_BY_CONTEXT/);
  assert.match(controller, /sourceConfig\.windsorProductKey/);
  assert.match(controller, /resolveProviderCredential\(connection, "access_token"\)/);
  assert.match(controller, /importWindsorAccountToDataHub/);
  assert.match(controller, /runWindsorBackfill/);
  assert.match(controller, /sellerKpiSummary/);
});

test("Windsor Data Hub adapter persists profiles schedule and canonical lineage metadata", async () => {
  const adapter = await source("../features/integrationPlatform/windsorDataHubService.js");
  assert.match(adapter, /MarketingDataSource/);
  assert.match(adapter, /runMarketingDataSource/);
  assert.match(adapter, /resolveWindsorFieldProfile/);
  assert.match(adapter, /provider:\s*"generic"/);
  assert.match(adapter, /managedBy:\s*"windsor_marketing_connector"/);
  assert.match(adapter, /profileKey/);
  assert.match(adapter, /windsorAccountId/);
  assert.match(adapter, /syncMode:\s*configuredCadence === "manual" \? "manual" : "scheduled"/);
  assert.match(adapter, /nextRunAt\(configuredCadence\)/);
  assert.match(adapter, /reserveWindsorApiRequest/);
  assert.match(adapter, /readOnly:\s*true/);
});

test("Windsor scheduled executor uses rate budget checkpoints and canonical Marketing Data Core", async () => {
  const scheduled = await source("../features/integrationPlatform/windsorScheduledSyncService.js");
  const worker = await source("../services/marketingDataSyncWorkerService.js");
  assert.match(scheduled, /source\.checkpoint\?\.watermark/);
  assert.match(scheduled, /reserveWindsorApiRequest/);
  assert.match(scheduled, /previewWindsorData/);
  assert.match(scheduled, /runMarketingDataSource/);
  assert.match(scheduled, /windsor_marketing_connector/);
  assert.match(worker, /runWindsorScheduledSource/);
  assert.match(worker, /isWindsorDataSource/);
});

test("Windsor persistent rate budget keeps headroom under documented limits", async () => {
  const model = await source("../models/WindsorApiUsageBudget.js");
  const rate = await source("../features/integrationPlatform/windsorRateBudgetService.js");
  assert.match(model, /period/);
  assert.match(model, /expiresAt/);
  assert.match(model, /unique:\s*true/);
  assert.match(rate, /DOCUMENTED_PER_MINUTE\s*=\s*600/);
  assert.match(rate, /DOCUMENTED_PER_DAY\s*=\s*10_000/);
  assert.match(rate, /DEFAULT_PER_MINUTE\s*=\s*540/);
  assert.match(rate, /DEFAULT_PER_DAY\s*=\s*9_000/);
  assert.match(rate, /WINDSOR_RATE_BUDGET_EXHAUSTED/);
});

test("Windsor backfill adaptively splits saturated date windows and never claims silent completeness", async () => {
  const backfill = await source("../features/integrationPlatform/windsorBackfillService.js");
  assert.match(backfill, /MAX_BACKFILL_DAYS\s*=\s*366/);
  assert.match(backfill, /MAX_REQUESTS_PER_OPERATION\s*=\s*120/);
  assert.match(backfill, /records\.length >= MAX_ROWS/);
  assert.match(backfill, /const halves = split\(current\)/);
  assert.match(backfill, /saturatedDays\.push/);
  assert.match(backfill, /complete:\s*saturatedDays\.length === 0/);
  assert.match(backfill, /checkpoint:\s*\{ watermark: originalWatermark \}/);
});

test("Windsor seller KPI service reads tenant-owned normalized Data Hub evidence", async () => {
  const kpi = await source("../features/integrationPlatform/windsorSellerKpiService.js");
  assert.match(kpi, /MarketingNormalisedRecord/);
  assert.match(kpi, /business:\s*businessId/);
  assert.match(kpi, /location:\s*locationId/);
  assert.match(kpi, /source:\s*source\._id/);
  assert.match(kpi, /resolveWindsorFieldProfile/);
  assert.match(kpi, /MAX_RECORDS\s*=\s*10_000/);
});

test("Windsor routes are permission protected under Marketing connections", async () => {
  const routes = await source("../features/integrationPlatform/marketingConnectedAccountsRoutes.js");
  assert.match(routes, /windsor\/catalogue/);
  assert.match(routes, /windsor\/:connector\/authorize/);
  assert.match(routes, /windsor\/:connector\/profiles/);
  assert.match(routes, /windsor\/:connector\/preview/);
  assert.match(routes, /windsor\/:connector\/import/);
  assert.match(routes, /windsor\/:connector\/backfill/);
  assert.match(routes, /windsor\/:connector\/seller-kpis/);
  assert.match(routes, /windsor\/:connector\/accounts\/:accountId/);
  assert.match(routes, /requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /requirePermissions\("feature-control:update"\)/);
});

test("frontend exposes Windsor commercial operations from one Marketing workspace", async () => {
  const page = await source("../../../frontend/src/pages/WindsorMarketingConnectionsPage.jsx");
  const panel = await source("../../../frontend/src/components/marketing/WindsorSourceOperationsPanel.jsx");
  const client = await source("../../../frontend/src/Services/marketingConnectionsService.js");
  assert.match(page, /Connect securely/);
  assert.match(page, /WindsorSourceOperationsPanel/);
  assert.match(page, /payload\?\.sources/);
  assert.match(panel, /Data profile/);
  assert.match(panel, /Automatic sync/);
  assert.match(panel, /Import history/);
  assert.match(panel, /Seller KPIs/);
  assert.match(panel, /option value="hourly"/);
  assert.match(panel, /option value="daily"/);
  assert.match(panel, /option value="weekly"/);
  assert.match(client, /backfillWindsorConnectorData/);
  assert.match(client, /getWindsorSellerKpis/);
});
