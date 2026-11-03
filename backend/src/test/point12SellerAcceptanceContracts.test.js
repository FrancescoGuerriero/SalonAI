import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  dataConnection,
} from "../features/integrationPlatform/dataConnectionCatalogue.js";
import {
  listDataConnectionFieldProfiles,
  resolveDataConnectionFieldProfile,
} from "../features/integrationPlatform/dataConnectionFieldProfiles.js";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Amazon Seller Central and eBay remain first-class Seller connections", () => {
  const amazon = dataConnection("amazon_sp");
  const ebay = dataConnection("ebay");

  assert.equal(amazon?.label, "Amazon Seller Central (Amazon SP)");
  assert.equal(amazon?.kind, "seller");
  assert.equal(amazon?.category, "Sellers");

  assert.equal(ebay?.label, "eBay");
  assert.equal(ebay?.kind, "seller");
  assert.equal(ebay?.category, "Sellers");
});

test("Amazon seller profiles provide governed order and inventory evidence", () => {
  const profiles = listDataConnectionFieldProfiles("amazon_sp");
  const keys = new Set(profiles.map(({ key }) => key));

  assert.deepEqual([...keys].sort(), ["inventory", "orders"]);
  assert.equal(resolveDataConnectionFieldProfile("amazon_sp")?.key, "orders");

  for (const profile of profiles) {
    assert.ok(profile.fields.includes("account_id"));
    assert.ok(profile.fields.includes("account_name"));
    assert.ok(profile.kpis.length > 0);
  }
});

test("eBay seller profiles cover Orders, Traffic and Promoted Listings", () => {
  const profiles = listDataConnectionFieldProfiles("ebay");
  const keys = new Set(profiles.map(({ key }) => key));

  assert.deepEqual([...keys].sort(), ["orders", "promotedListings", "traffic"]);
  assert.equal(resolveDataConnectionFieldProfile("ebay")?.key, "orders");

  for (const profile of profiles) {
    assert.ok(profile.fields.includes("account_id"));
    assert.ok(profile.fields.includes("account_name"));
    assert.ok(profile.kpis.length > 0);
  }
});

test("seller imports are Location-owned, read-only and support the scheduled roadmap cadences", async () => {
  const [dataHub, panel] = await Promise.all([
    source("../features/integrationPlatform/dataConnectionDataHubService.js"),
    source("../../../frontend/src/components/marketing/DataSourceOperationsPanel.jsx"),
  ]);

  assert.match(dataHub, /const CADENCES = new Set\(\["manual", "hourly", "daily", "weekly"\]\)/);
  assert.match(dataHub, /business:\s*businessId,\s*location:\s*locationId,\s*key/);
  assert.match(dataHub, /sourceConfig:[\s\S]*readOnly:\s*true/);
  assert.match(dataHub, /runMarketingDataSource\([\s\S]*\{ businessId, locationId, actor \}/);

  for (const cadence of ["manual", "hourly", "daily", "weekly"]) {
    assert.match(panel, new RegExp(`<option value="${cadence}">`, "i"));
  }
  assert.match(panel, /Import to Data Hub/);
  assert.match(panel, /Import history/);
  assert.match(panel, /Seller KPIs/);
});

test("seller KPI projection remains constrained to the active Business and Location", async () => {
  const service = await source("../features/integrationPlatform/sellerKpiService.js");

  assert.match(
    service,
    /MarketingDataSource\.findOne\(\{[\s\S]*business:\s*businessId[\s\S]*location:\s*locationId/
  );
  assert.match(
    service,
    /MarketingNormalisedRecord\.find\(\{[\s\S]*business:\s*businessId[\s\S]*location:\s*locationId[\s\S]*source:\s*source\._id/
  );
  assert.match(service, /const MAX_RECORDS = 10_000/);
});

test("seller provider operations remain read-only apart from explicit account unlink", async () => {
  const [gateway, dataHub, client] = await Promise.all([
    source("../features/integrationPlatform/dataConnectionGatewayService.js"),
    source("../features/integrationPlatform/dataConnectionDataHubService.js"),
    source("../../../frontend/src/Services/marketingConnectionsService.js"),
  ]);

  assert.match(gateway, /readOnlyByDefault:\s*true/);
  assert.match(dataHub, /readOnly:\s*true/);
  assert.doesNotMatch(client, /createListing|updateListing|deleteListing|payout|mutateProduct|publishProduct/i);
});
