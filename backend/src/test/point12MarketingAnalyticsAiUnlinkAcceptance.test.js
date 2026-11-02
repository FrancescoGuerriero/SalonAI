import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Marketing deterministic seller metrics are projected from tenant-owned normalised Data Hub evidence", async () => {
  const service = await source("../features/integrationPlatform/sellerKpiService.js");

  assert.match(service, /MarketingNormalisedRecord\.find\(\{/);
  assert.match(service, /business:\s*businessId/);
  assert.match(service, /location:\s*locationId/);
  assert.match(service, /source:\s*source\._id/);
  assert.match(service, /aggregate\(records, definition\)/);
  assert.doesNotMatch(service, /Math\.random|faker|fabricat/i);
});

test("Marketing AI remains advisory over AIIBP Data Hub evidence with human review and no external writes", async () => {
  const registry = await source("../../../ai-service/app/governance/ai_registry.py");

  assert.match(
    registry,
    /"key": "marketing-insights"[\s\S]*"authority": "aiibp_data_hub"[\s\S]*"mode": "advisory"/
  );
  assert.match(
    registry,
    /"key": "marketing-insights"[\s\S]*"humanApprovalRequired": True[\s\S]*"externalWriteAllowed": False/
  );
  assert.match(registry, /"evidenceContract": "data_hub_evidence_v1"/);
  assert.match(registry, /"forecastExecutionAuthorised": False/);
  assert.match(registry, /"automaticPromotionAllowed": False/);
});

test("Marketing AI UI remains permission-gated and consumes the read-only insight endpoint", async () => {
  const [app, client] = await Promise.all([
    source("../../../frontend/src/App.jsx"),
    source("../../../frontend/src/Services/aiMarketingInsightsService.js"),
  ]);

  assert.match(
    app,
    /path="ai\/marketing-insights"[\s\S]*permissionPage\(AiMarketingInsightsPage, "ai:use"\)/
  );
  assert.match(client, /API\.get\(\s*"\/ai\/marketing-insights"/);
  assert.doesNotMatch(client, /API\.(post|put|patch|delete)\(\s*"\/ai\/marketing-insights"/);
});

test("managed account unlink is Business-owned and does not delete retained Data Hub evidence", async () => {
  const controller = await source("../features/integrationPlatform/dataConnectionController.js");
  const start = controller.indexOf("export async function unlinkAccount");
  const end = controller.indexOf("\n}\n", start);
  const unlink = controller.slice(start, end + 3);

  assert.ok(start >= 0);
  assert.match(unlink, /const tenantBusinessId = businessId\(request\)/);
  assert.match(unlink, /connectionForBusiness\(tenantBusinessId, key\)/);
  assert.match(unlink, /assertOwnedAccount\(connection, accountId\)/);
  assert.match(unlink, /unlinkLinkedDataAccount/);
  assert.match(unlink, /reconcileConnection\(tenantBusinessId, key, entry\)/);
  assert.doesNotMatch(unlink, /MarketingDataSource\.(delete|deleteMany|deleteOne|findByIdAndDelete|findOneAndDelete)/);
});

test("browser unlink calls the explicit managed-account endpoint and no historical-delete endpoint", async () => {
  const client = await source("../../../frontend/src/Services/marketingConnectionsService.js");

  assert.match(
    client,
    /API\.delete\([\s\S]*data-connections[\s\S]*accounts[\s\S]*accountId/
  );
  assert.doesNotMatch(client, /deleteHistory|deleteImportedData|purgeDataHub|deleteEvidence/i);
});
