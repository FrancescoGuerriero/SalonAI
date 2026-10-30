import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DATA_CONNECTIONS,
  dataConnection,
  listDataConnections,
} from "../features/integrationPlatform/dataConnectionCatalogue.js";
import {
  listDataConnectionFieldProfiles,
  resolveDataConnectionFieldProfile,
} from "../features/integrationPlatform/dataConnectionFieldProfiles.js";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Point 12 catalogue includes requested seller connections", () => {
  const amazon = dataConnection("amazon_sp");
  const ebay = dataConnection("ebay");
  assert.equal(amazon?.kind, "seller");
  assert.equal(ebay?.kind, "seller");
  assert.equal(amazon?.category, "Sellers");
  assert.equal(ebay?.category, "Sellers");
});

test("AIIBP data connection catalogue separates sources, sellers and destinations", () => {
  const kinds = new Set(listDataConnections().map(({ kind }) => kind));
  for (const kind of ["source", "seller", "data-platform", "destination", "ai-destination"]) {
    assert.ok(kinds.has(kind), `${kind} must remain represented in the connection catalogue`);
  }
});

test("requested connection catalogue is broad and metadata-driven", () => {
  assert.ok(DATA_CONNECTIONS.length >= 25);
  for (const item of DATA_CONNECTIONS) {
    assert.ok(item.key);
    assert.ok(item.label);
    assert.ok(item.kind);
    assert.ok(item.category);
  }
});

test("managed gateway keeps secrets server-side and uses provider-neutral configuration", async () => {
  const gateway = await source("../features/integrationPlatform/dataConnectionGatewayService.js");
  assert.match(gateway, /AIIBP_DATA_CONNECTION_GATEWAY_URL/);
  assert.match(gateway, /AIIBP_DATA_CONNECTION_GATEWAY_TOKEN/);
  assert.doesNotMatch(gateway, /password/);
});

test("data connection controller enforces tenant-owned accounts and sources", async () => {
  const controller = await source("../features/integrationPlatform/dataConnectionController.js");
  assert.match(controller, /businessId/);
  assert.match(controller, /locationId/);
  assert.match(controller, /request\.effectiveAuthority/);
});

test("Data Hub adapter uses canonical Marketing Data Core and neutral ownership metadata", async () => {
  const adapter = await source("../features/integrationPlatform/dataHubConnectionAdapter.js");
  assert.match(adapter, /Marketing Data Core/);
  assert.match(adapter, /businessId/);
  assert.match(adapter, /locationId/);
});

test("scheduled executor uses checkpoints and the shared Marketing sync worker", async () => {
  const executor = await source("../features/integrationPlatform/dataConnectionScheduleExecutor.js");
  assert.match(executor, /checkpoint/);
  assert.match(executor, /marketingDataSyncWorkerService/);
});

test("backfill is bounded and reports saturated one-day windows", async () => {
  const backfill = await source("../features/integrationPlatform/dataConnectionBackfillService.js");
  assert.match(backfill, /one-day/i);
  assert.match(backfill, /saturated/i);
});

test("seller profiles and KPI summaries remain AIIBP-owned", async () => {
  const profiles = listDataConnectionFieldProfiles("amazon_sp");
  assert.ok(profiles.length > 0);
  assert.ok(resolveDataConnectionFieldProfile("amazon_sp", profiles[0].key));
  const kpis = await source("../features/integrationPlatform/sellerKpiService.js");
  assert.match(kpis, /resolveDataConnectionFieldProfile/);
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
});

test("frontend exposes AIIBP-owned data connections", async () => {
  const router = await source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx");
  const landing = await source("../../../frontend/src/pages/MarketingModulePage.jsx");
  const page = await source("../../../frontend/src/pages/MarketingDataConnectionsPage.jsx");
  const client = await source("../../../frontend/src/Services/marketingConnectionsService.js");
  assert.match(router, /pathname === "\/marketing\/data-connections"/);
  assert.match(landing, /Marketing Data Hub/);
  assert.match(landing, /Seller & commerce evidence/);
  assert.match(page, /AIIBP data connections/);
  assert.match(page, /Connect securely/);
  assert.match(client, /importManagedDataConnection/);
});
