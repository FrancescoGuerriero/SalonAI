import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test("customer retention publishes the canonical retention-rate contract", async () => {
  const [service, controller] = await Promise.all([
    source("../services/canonicalCustomerRetentionService.js"),
    source("../controllers/customerRetentionController.js"),
  ]);

  assert.match(service, /calculateCanonicalRatio\([\s\S]*?"retention-rate"/);
  assert.match(service, /canonicalMetricEvidence\("retention-rate"\)/);
  assert.match(service, /legacyCustomerRetentionService/);
  assert.match(controller, /canonicalCustomerRetentionService\.js/);
});

test("dashboard operations publishes canonical utilisation while retaining legacy query logic", async () => {
  const [service, controller] = await Promise.all([
    source("../services/canonicalDashboardOperationsService.js"),
    source("../controllers/dashboardOperationsController.js"),
  ]);

  assert.match(service, /calculateCanonicalRatio\([\s\S]*?"utilisation-rate"/);
  assert.match(service, /snapshot\.bookedMinutes/);
  assert.match(service, /snapshot\.scheduledMinutes/);
  assert.match(service, /canonicalMetricEvidence\("utilisation-rate"\)/);
  assert.match(service, /legacyDashboardOperationsService/);
  assert.match(controller, /canonicalDashboardOperationsService\.js/);
});
