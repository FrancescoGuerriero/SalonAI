import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Marketing and BI persistence models require a Location owner", async () => {
  const models = await Promise.all([
    source("../models/MarketingDataSource.js"),
    source("../models/MarketingRawRecord.js"),
    source("../models/MarketingNormalisedRecord.js"),
    source("../models/MarketingSyncRun.js"),
    source("../models/SeoPageObservation.js"),
    source("../models/DataHubSavedView.js"),
    source("../models/DataHubDestinationTask.js"),
    source("../models/DataHubDestinationRun.js"),
  ]);
  for (const model of models) {
    assert.match(model, /location:\s*\{[\s\S]*?ref:\s*"Location"[\s\S]*?required:\s*true/);
  }
});

test("Marketing Data Core writes raw, normalised, sync and SEO data inside the selected location", async () => {
  const service = await source("../features/integrationPlatform/marketingDataCoreService.js");
  assert.match(service, /sourceForLocation\(sourceId, businessId, locationId\)/);
  assert.match(service, /MarketingRawRecord\.create\(\{[\s\S]*business:\s*businessId,[\s\S]*location:\s*locationId/);
  assert.match(service, /MarketingNormalisedRecord\.create\(\{[\s\S]*business:\s*businessId,[\s\S]*location:\s*locationId/);
  assert.match(service, /MarketingSyncRun\.create\(\{[\s\S]*business:\s*businessId,[\s\S]*location:\s*locationId/);
  assert.match(service, /SeoPageObservation\.insertMany\([\s\S]*location:\s*locationId/);
  assert.match(service, /const scope = \{ business: businessId, location: locationId \}/);
});

test("Marketing API and live-provider execution fail closed without a selected location", async () => {
  const [controller, providerRunner] = await Promise.all([
    source("../features/integrationPlatform/marketingDataCoreController.js"),
    source("../features/integrationPlatform/marketingProviderRunService.js"),
  ]);
  assert.match(controller, /effectiveAuthority\?\.locationId/);
  assert.match(controller, /tenantContext\?\.locationId/);
  assert.match(controller, /LOCATION_REQUIRED/);
  assert.match(providerRunner, /objectId\(locationId, "location"\)/);
  assert.match(providerRunner, /business:\s*businessId,[\s\S]*location:\s*locationId/);
  assert.match(providerRunner, /liveProviderExecution === false/);
});

test("Provider credentials may be business-level while provisioned Data Hub sources are location-owned", async () => {
  const [provisioning, connectionModel] = await Promise.all([
    source("../features/integrationPlatform/marketingSourceProvisioningService.js"),
    source("../models/IntegrationConnection.js"),
  ]);
  assert.match(provisioning, /\{ business: businessId, location: locationId, key \}/);
  assert.match(provisioning, /location:\s*locationId/);
  assert.match(provisioning, /liveProviderExecution:\s*false/);
  assert.match(provisioning, /MarketingDataSource\.updateMany/);
  assert.doesNotMatch(connectionModel, /location:\s*\{\s*type:\s*Schema\.Types\.ObjectId/);
});

test("Retries and scheduled sync workers preserve source location ownership", async () => {
  const [recovery, worker] = await Promise.all([
    source("../features/integrationPlatform/marketingDataRecoveryService.js"),
    source("../services/marketingDataSyncWorkerService.js"),
  ]);
  assert.match(recovery, /locationId:\s*prior\.location/);
  assert.match(recovery, /MARKETING_SYNC_LOCATION_REQUIRED/);
  assert.match(worker, /locationId:\s*source\.location/);
  assert.match(worker, /MARKETING_SOURCE_LOCATION_REQUIRED/);
  assert.match(worker, /location:\s*\{ \$ne: null \}/);
});

test("Data Hub saved views, destinations and AI evidence remain location-bound", async () => {
  const [service, controller, gateway] = await Promise.all([
    source("../features/integrationPlatform/dataHubService.js"),
    source("../features/integrationPlatform/dataHubController.js"),
    source("../features/integrationPlatform/dataHubAiGatewayService.js"),
  ]);
  assert.match(service, /savedViewForLocation/);
  assert.match(service, /destinationTaskForLocation/);
  assert.match(service, /businessWideAggregationRequiresExplicitAuthority:\s*true/);
  assert.match(controller, /Select a location before using Data Hub or AI evidence/);
  assert.match(gateway, /location_id:\s*String\(locationId\)/);
  assert.match(gateway, /businessWideAggregationAuthorised:\s*false/);
  assert.match(gateway, /inferenceExecuted:\s*false/);
  assert.match(gateway, /externalWriteAuthorised:\s*false/);
});
