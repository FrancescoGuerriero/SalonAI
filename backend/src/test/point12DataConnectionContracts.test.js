import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  dataConnection,
  listDataConnections,
} from "../features/integrationPlatform/dataConnectionCatalogue.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = (relative) => fs.readFile(path.resolve(here, relative), "utf8");

test("Point 12 catalogue includes requested seller connections", () => {
  const sellers = listDataConnections({ kind: "seller" });
  const keys = new Set(sellers.map(({ key }) => key));
  assert.ok(keys.has("amazon_sp"));
  assert.ok(keys.has("ebay"));
  assert.equal(dataConnection("amazon_sp").category, "Sellers");
  assert.equal(dataConnection("ebay").category, "Sellers");
});

test("AIIBP data connection catalogue separates sources, sellers and destinations", () => {
  assert.equal(dataConnection("chatgpt").kind, "ai-destination");
  assert.equal(dataConnection("claude").kind, "ai-destination");
  assert.equal(dataConnection("copilot_agent").kind, "ai-destination");
  assert.equal(dataConnection("power_bi").kind, "destination");
  assert.equal(dataConnection("amazon_redshift").kind, "data-platform");
  assert.equal(dataConnection("google_ads").kind, "source");
  assert.equal(dataConnection("amazon_sp").kind, "seller");
});

test("requested connection catalogue is broad and metadata-driven", () => {
  const all = listDataConnections();
  assert.ok(all.length >= 85, `expected at least 85 requested connectors, found ${all.length}`);
  assert.ok(all.every((item) => item.key && item.label && item.category && item.kind));
  assert.equal(new Set(all.map(({ key }) => key)).size, all.length);
});

test("managed gateway keeps secrets server-side and uses provider-neutral configuration", async () => {
  const service = await source("../features/integrationPlatform/dataConnectionGatewayService.js");
  assert.match(service, /AIIBP_DATA_CONNECTION_API_KEY/);
  assert.match(service, /AIIBP_DATA_CONNECTION_API_BASE_URL/);
  assert.match(service, /AIIBP_DATA_CONNECTION_ONBOARD_BASE_URL/);
  assert.match(service, /searchParams\.set\("select_accounts", account\)/);
  assert.match(service, /searchParams\.set\("_max_rows"/);
  assert.match(service, /searchParams\.set\("date_from"/);
  assert.match(service, /searchParams\.set\("date_to"/);
  assert.match(service, /searchParams\.set\("refresh_since"/);
  assert.doesNotMatch(service, /windsor\.ai/i);
  assert.doesNotMatch(service, /WINDSOR_API_KEY/);
});

test("data connection controller enforces tenant-owned accounts and sources", async () => {
  const controller = await source("../features/integrationPlatform/dataConnectionController.js");
  assert.match(controller, /request\.effectiveAuthority\?\.businessId/);
  assert.match(controller, /DATA_CONNECTION_ACCOUNT_NOT_OWNED_BY_BUSINESS/);
  assert.match(controller, /DATA_CONNECTION_SOURCE_NOT_OWNED_BY_CONTEXT/);
  assert.match(controller, /resolveProviderCredential\(connection, "access_token"\)/);
  assert.match(controller, /storeProviderCredential/);
  assert.match(controller, /importDataConnectionAccountToDataHub/);
  assert.match(controller, /locationId\(request, \{ required: true \}\)/);
});

test("Data Hub adapter uses canonical Marketing Data Core and neutral ownership metadata", async () => {
  const adapter = await source("../features/integrationPlatform/dataConnectionDataHubService.js");
  assert.match(adapter, /MarketingDataSource/);
  assert.match(adapter, /runMarketingDataSource/);
  assert.match(adapter, /provider:\s*"generic"/);
  assert.match(adapter, /managedBy:\s*"aiibp_data_connections"/);
  assert.match(adapter, /dataConnectionAccountId/);
  assert.match(adapter, /readOnly:\s*true/);
});

test("scheduled executor uses checkpoints and the shared Marketing sync worker", async () => {
  const scheduled = await source("../features/integrationPlatform/dataConnectionScheduledSyncService.js");
  const worker = await source("../services/marketingDataSyncWorkerService.js");
  assert.match(scheduled, /checkpoint\?\.watermark/);
  assert.match(scheduled, /runMarketingDataSource/);
  assert.match(scheduled, /reserveDataConnectionApiRequest/);
  assert.match(worker, /isManagedDataConnectionSource/);
  assert.match(worker, /runManagedDataConnectionSource/);
  assert.match(worker, /aiibp_data_connections/);
});

test("backfill is bounded and reports saturated one-day windows", async () => {
  const backfill = await source("../features/integrationPlatform/dataConnectionBackfillService.js");
  assert.match(backfill, /MAX_BACKFILL_DAYS\s*=\s*366/);
  assert.match(backfill, /MAX_REQUESTS_PER_OPERATION\s*=\s*120/);
  assert.match(backfill, /saturatedDays/);
  assert.match(backfill, /reserveDataConnectionApiRequest/);
  assert.match(backfill, /complete:\s*saturatedDays\.length === 0/);
});

test("seller profiles and KPI summaries remain AIIBP-owned", async () => {
  const profiles = await source("../features/integrationPlatform/dataConnectionFieldProfiles.js");
  const kpis = await source("../features/integrationPlatform/sellerKpiService.js");
  assert.match(profiles, /amazon_sp/);
  assert.match(profiles, /ebay/);
  assert.match(kpis, /MarketingNormalisedRecord/);
  assert.match(kpis, /resolveDataConnectionFieldProfile/);
  assert.doesNotMatch(profiles, /Windsor/i);
  assert.doesNotMatch(kpis, /Windsor/i);
});

test("routes are permission protected under AIIBP managed data connections", async () => {
  const routes = await source("../features/integrationPlatform/marketingConnectedAccountsRoutes.js");
  assert.match(routes, /data-connections\/catalogue/);
  assert.match(routes, /data-connections\/:connector\/authorize/);
  assert.match(routes, /data-connections\/:connector\/reconcile/);
  assert.match(routes, /data-connections\/:connector\/preview/);
  assert.match(routes, /data-connections\/:connector\/import/);
  assert.match(routes, /data-connections\/:connector\/backfill/);
  assert.match(routes, /data-connections\/:connector\/seller-kpis/);
  assert.match(routes, /requirePermissions\("feature-control:read"\)/);
  assert.match(routes, /requirePermissions\("feature-control:update"\)/);
  assert.doesNotMatch(routes, /\/windsor\//i);
});

test("frontend exposes AIIBP data connections without inspiration branding", async () => {
  const router = await source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx");
  const landing = await source("../../../frontend/src/pages/MarketingModulePage.jsx");
  const page = await source("../../../frontend/src/pages/MarketingDataConnectionsPage.jsx");
  const client = await source("../../../frontend/src/Services/marketingConnectionsService.js");
  assert.match(router, /pathname === "\/marketing\/data-connections"/);
  assert.match(landing, /Data connections/);
  assert.match(landing, /Sellers/);
  assert.match(page, /AIIBP data connections/);
  assert.match(page, /Connect securely/);
  assert.match(client, /importManagedDataConnection/);
  for (const content of [router, landing, page, client]) {
    assert.doesNotMatch(content, /Windsor/i);
    assert.doesNotMatch(content, /Zenoti/i);
  }
});
