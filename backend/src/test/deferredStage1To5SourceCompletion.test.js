import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  COMMERCE_METRIC_KEYS,
  getMetricDefinition,
} from "../features/analytics/metricCatalogue.js";
import {
  MARKETING_PROVIDER_ENDPOINTS,
} from "../features/integrationPlatform/marketingProviderAdapters.js";
import {
  getMarketingDataSyncWorkerStatus,
  runMarketingDataSyncWorkerCycle,
} from "../services/marketingDataSyncWorkerService.js";

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("deferred Stage 3 commerce metrics are promoted into the canonical Stage 5 catalogue", () => {
  assert.deepEqual(COMMERCE_METRIC_KEYS, [
    "payment-link-conversion-rate",
    "membership-collection-failure-rate",
    "membership-collection-recovery-rate",
  ]);
  for (const key of COMMERCE_METRIC_KEYS) {
    const definition = getMetricDefinition(key);
    assert.equal(definition.version, "2.1.0");
    assert.ok(definition.formula);
    assert.ok(definition.evidence.sourceModel);
  }
});

test("marketing provider executors use fixed official HTTPS endpoints", () => {
  assert.equal(MARKETING_PROVIDER_ENDPOINTS.googleToken, "https://oauth2.googleapis.com/token");
  assert.equal(MARKETING_PROVIDER_ENDPOINTS.ga4, "https://analyticsdata.googleapis.com/v1beta");
  assert.equal(MARKETING_PROVIDER_ENDPOINTS.searchConsole, "https://www.googleapis.com/webmasters/v3");
  assert.equal(MARKETING_PROVIDER_ENDPOINTS.bingApi, "https://www.bing.com/webmaster/api.svc/json");
  assert.equal(MARKETING_PROVIDER_ENDPOINTS.bingToken, "https://www.bing.com/webmasters/oauth/token");
});

test("provider credential API never returns supplied provider secrets", async () => {
  const service = await source("../features/integrationPlatform/providerCredentialService.js");
  assert.match(service, /encryptIntegrationSecret/);
  assert.match(service, /secretReturned: false/);
  assert.match(service, /delete value\.secretCiphertext/);
  assert.match(service, /delete value\.secretIv/);
  assert.match(service, /delete value\.secretTag/);
  assert.doesNotMatch(service, /secretReturnedOnce: true/);
});

test("Marketing Data worker is disabled by default and will not run implicitly", async () => {
  delete process.env.MARKETING_DATA_SYNC_WORKER_ENABLED;
  const before = getMarketingDataSyncWorkerStatus();
  assert.equal(before.enabled, false);
  assert.equal(before.started, false);
  const result = await runMarketingDataSyncWorkerCycle();
  assert.equal(result.skipped, true);
  assert.match(result.reason, /disabled/i);
});

test("Marketing Data worker selects only explicitly scheduled active sources", async () => {
  const worker = await source("../services/marketingDataSyncWorkerService.js");
  assert.match(worker, /status: "active"/);
  assert.match(worker, /syncMode: \{ \$in: \["scheduled", "incremental"\] \}/);
  assert.match(worker, /"schedule\.nextRunAt": \{ \$ne: null, \$lte: now \}/);
  assert.match(worker, /MARKETING_DATA_SYNC_WORKER_ENABLED/);
  assert.match(worker, /false\)/);
});
