import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  listWindsorMarketingConnectors,
  windsorMarketingConnector,
} from "../features/integrationPlatform/windsorConnectorCatalogue.js";

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

test("Windsor controller enforces tenant-owned account IDs and accepts governed sync cadence", async () => {
  const controller = await source("../features/integrationPlatform/windsorConnectorController.js");
  assert.match(controller, /request\.effectiveAuthority\?\.businessId/);
  assert.match(controller, /WINDSOR_ACCOUNT_NOT_OWNED_BY_BUSINESS/);
  assert.match(controller, /resolveProviderCredential\(connection, "access_token"\)/);
  assert.match(controller, /importWindsorAccountToDataHub/);
  assert.match(controller, /syncCadence:\s*payload\.syncCadence/);
  assert.match(controller, /timezone:\s*payload\.timezone/);
});

test("Windsor Data Hub adapter persists schedule and canonical lineage metadata", async () => {
  const adapter = await source("../features/integrationPlatform/windsorDataHubService.js");
  assert.match(adapter, /MarketingDataSource/);
  assert.match(adapter, /runMarketingDataSource/);
  assert.match(adapter, /provider:\s*"generic"/);
  assert.match(adapter, /managedBy:\s*"windsor_marketing_connector"/);
  assert.match(adapter, /windsorAccountId/);
  assert.match(adapter, /syncMode:\s*configuredCadence === "manual" \? "manual" : "scheduled"/);
  assert.match(adapter, /nextRunAt\(configuredCadence\)/);
  assert.match(adapter, /readOnly:\s*true/);
});

test("Windsor scheduled executor uses checkpoints and canonical Marketing Data Core", async () => {
  const scheduled = await source("../features/integrationPlatform/windsorScheduledSyncService.js");
  const worker = await source("../services/marketingDataSyncWorkerService.js");
  assert.match(scheduled, /source\.checkpoint\?\.watermark/);
  assert.match(scheduled, /previewWindsorData/);
  assert.match(scheduled, /runMarketingDataSource/);
  assert.match(scheduled, /windsor_marketing_connector/);
  assert.match(worker, /runWindsorScheduledSource/);
  assert.match(worker, /isWindsorDataSource/);
  assert.match(worker, /windsor_marketing_connector/);
});

test("Windsor routes are permission protected under Marketing connections", async () => {
  const routes = await source("../features/integrationPlatform/marketingConnectedAccountsRoutes.js");
  assert.match(routes, /windsor\/catalogue/);
  assert.match(routes, /windsor\/:connector\/authorize/);
  assert.match(routes, /windsor\/:connector\/reconcile/);
  assert.match(routes, /windsor\/:connector\/preview/);
  assert.match(routes, /windsor\/:connector\/import/);
  assert.match(routes, /windsor\/:connector\/accounts\/:accountId/);
  assert.match(routes, /requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /requirePermissions\("feature-control:update"\)/);
});

test("frontend exposes Windsor cadence selection and Data Hub import", async () => {
  const windsor = await source("../../../frontend/src/pages/WindsorMarketingConnectionsPage.jsx");
  const client = await source("../../../frontend/src/Services/marketingConnectionsService.js");
  assert.match(windsor, /Connect securely/);
  assert.match(windsor, /Amazon, eBay/);
  assert.match(windsor, /provider password/);
  assert.match(windsor, /Import to Data Hub/);
  assert.match(windsor, /Windsor import sync cadence/);
  assert.match(windsor, /option value="hourly"/);
  assert.match(windsor, /option value="daily"/);
  assert.match(windsor, /option value="weekly"/);
  assert.match(client, /importWindsorConnectorData/);
});
