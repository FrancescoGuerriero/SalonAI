import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  marketingConnectorCatalogue,
  marketingConnectorDefinition,
} from "../features/integrationPlatform/marketingConnectorCatalogue.js";
import {
  API_RATE_LIMIT_CONTRACT_VERSION,
} from "../features/integrationPlatform/integrationApiAuth.js";
import {
  listMetricDefinitions,
} from "../features/analytics/metricCatalogue.js";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("Stage 5 connector catalogue versions retained Marketing Data Core providers", () => {
  const catalogue = marketingConnectorCatalogue();
  assert.equal(catalogue.version, "1.0.0");
  assert.deepEqual(
    catalogue.connectors.map((entry) => entry.key),
    ["ga4", "google_search_console", "bing_webmaster", "generic", "technical_seo"]
  );
  assert.equal(marketingConnectorDefinition("ga4").entityType, "analytics_event");
  assert.equal(marketingConnectorDefinition("google_search_console").entityType, "search_performance");
  assert.equal(marketingConnectorDefinition("technical_seo").liveActivation, "none");
});

test("Stage 5 canonical metric and rate-limit contracts are explicitly versioned", () => {
  const metrics = listMetricDefinitions();
  assert.ok(metrics.length >= 9);
  assert.ok(metrics.every((metric) => /^\d+\.\d+\.\d+$/.test(metric.version)));
  assert.equal(API_RATE_LIMIT_CONTRACT_VERSION, "1.0.0");
});

test("Stage 5 Marketing Data Core persists raw and normalised lineage", async () => {
  const [rawModel, normalisedModel, service] = await Promise.all([
    source("../models/MarketingRawRecord.js"),
    source("../models/MarketingNormalisedRecord.js"),
    source("../features/integrationPlatform/marketingDataCoreService.js"),
  ]);

  assert.match(rawModel, /payloadHash/);
  assert.match(rawModel, /reconciliationStatus/);
  assert.match(normalisedModel, /rawRecord/);
  assert.match(normalisedModel, /lineage/);
  assert.match(normalisedModel, /providerSchemaVersion/);
  assert.match(service, /MarketingRawRecord\.create/);
  assert.match(service, /MarketingNormalisedRecord\.create/);
  assert.match(service, /raw\.reconciliationStatus = "normalised"/);
  assert.match(service, /counters\.reconciled/);
});

test("Stage 5 failed raw records are explicit and retryable instead of falsely reconciled", async () => {
  const service = await source("../features/integrationPlatform/marketingDataCoreService.js");
  assert.match(service, /reconciliationStatus: "failed"/);
  assert.match(service, /reconciliationMessage: message/);
  assert.match(service, /raw\.reconciliationStatus = "pending"/);
  assert.match(service, /MarketingNormalisedRecord\.findOne/);
  assert.doesNotMatch(service, /if \(raw\) \{\s*counters\.reconciled \+= 1;\s*continue;/);
});

test("Stage 5 source onboarding never accepts embedded provider secrets", async () => {
  const service = await source("../features/integrationPlatform/marketingDataCoreService.js");
  assert.match(service, /FORBIDDEN_CONFIG_KEY/);
  assert.match(service, /Secrets are not accepted/);
  assert.match(service, /IntegrationApp credential versions/);
  assert.match(service, /LIVE_CONNECTOR_NOT_ACTIVATED/);
});

test("Stage 5 sync contract includes preview scheduled incremental backfill and health", async () => {
  const [sourceModel, runModel, service] = await Promise.all([
    source("../models/MarketingDataSource.js"),
    source("../models/MarketingSyncRun.js"),
    source("../features/integrationPlatform/marketingDataCoreService.js"),
  ]);

  assert.match(sourceModel, /syncMode/);
  assert.match(sourceModel, /checkpoint/);
  assert.match(sourceModel, /fieldCatalogue/);
  assert.match(runModel, /"preview", "manual", "scheduled", "incremental", "backfill", "seo_scan"/);
  assert.match(runModel, /checkpointBefore/);
  assert.match(runModel, /checkpointAfter/);
  assert.match(runModel, /nextRetryAt/);
  assert.match(service, /ConnectorHealth\.findOneAndUpdate/);
  assert.match(service, /previewMarketingData/);
  assert.match(service, /runMarketingDataSource/);
});

test("Stage 5 failure recovery retries only failed or partial runs", async () => {
  const [recovery, routes] = await Promise.all([
    source("../features/integrationPlatform/marketingDataRecoveryService.js"),
    source("../features/integrationPlatform/marketingDataCoreRoutes.js"),
  ]);
  assert.match(recovery, /\["failed", "partial"\]/);
  assert.match(recovery, /retryOf: prior\._id/);
  assert.match(recovery, /attempt: Number\(prior\.attempt/);
  assert.match(recovery, /runMarketingDataSource/);
  assert.match(routes, /\/runs\/:runId\/retry/);
});

test("Stage 5 technical SEO crawler is bounded and rejects unsafe origins", async () => {
  const crawler = await source("../features/integrationPlatform/technicalSeoCrawler.js");
  assert.match(crawler, /MAX_RESPONSE_BYTES/);
  assert.match(crawler, /MAX_REDIRECTS/);
  assert.match(crawler, /SEO crawling requires HTTPS URLs/);
  assert.match(crawler, /public network addresses/);
  assert.match(crawler, /same-origin URLs/);
  assert.match(crawler, /Math\.min\(100/);
  assert.match(crawler, /missing-title/);
  assert.match(crawler, /missing-meta-description/);
  assert.match(crawler, /missing-canonical/);
});

test("Stage 5 management routes consolidate observability under integration platform", async () => {
  const [routes, controller, auth] = await Promise.all([
    source("../features/integrationPlatform/integrationPlatformRoutes.js"),
    source("../features/integrationPlatform/integrationPlatformController.js"),
    source("../features/integrationPlatform/integrationApiAuth.js"),
  ]);
  assert.match(routes, /router\.use\(\s*"\/marketing-data"/);
  assert.match(routes, /\/stage-5-contract/);
  assert.match(controller, /listMetricDefinitions/);
  assert.match(controller, /marketingConnectorCatalogue/);
  assert.match(auth, /X-RateLimit-Policy-Version/);
  assert.match(auth, /ratePolicyVersion/);
});
