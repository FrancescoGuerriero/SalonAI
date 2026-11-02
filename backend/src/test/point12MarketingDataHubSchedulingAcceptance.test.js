import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Marketing Data Hub import requires Business and Location ownership and reuses one canonical source", async () => {
  const [controller, service] = await Promise.all([
    source("../features/integrationPlatform/dataConnectionController.js"),
    source("../features/integrationPlatform/dataConnectionDataHubService.js"),
  ]);

  assert.match(controller, /locationId\(request, \{ required: true \}\)/);
  assert.match(
    service,
    /MarketingDataSource\.findOneAndUpdate\(\s*\{ business: businessId, location: locationId, key \}/
  );
  assert.match(service, /runMarketingDataSource/);
  assert.match(service, /\{ businessId, locationId, actor \}/);
});

test("automatic Marketing Data Connection cadences populate nextRunAt while manual remains unscheduled", async () => {
  const service = await source("../features/integrationPlatform/dataConnectionDataHubService.js");

  assert.match(service, /const CADENCES = new Set\(\["manual", "hourly", "daily", "weekly"\]\)/);
  assert.match(service, /if \(value === "manual"\) return null/);
  assert.match(service, /value === "hourly"/);
  assert.match(service, /value === "weekly"/);
  assert.match(service, /schedule:[\s\S]*cadence:\s*configuredCadence[\s\S]*nextRunAt:\s*nextRunAt\(configuredCadence\)/);
});

test("shared Marketing Data worker executes due managed sources with Business and Location scope", async () => {
  const worker = await source("../services/marketingDataSyncWorkerService.js");

  assert.match(worker, /isManagedDataConnectionSource\(source\)/);
  assert.match(
    worker,
    /runManagedDataConnectionSource\([\s\S]*businessId:\s*source\.business[\s\S]*locationId:\s*source\.location/
  );
  assert.match(
    worker,
    /MarketingDataSource\.updateOne\(\s*\{ _id: source\._id, business: source\.business, location: source\.location \}/
  );
  assert.match(worker, /MARKETING_SOURCE_LOCATION_REQUIRED/);
  assert.match(worker, /"schedule\.nextRunAt": \{ \$ne: null, \$lte: now \}/);
});

test("scheduled managed sync preserves tenant scope and incremental checkpoints", async () => {
  const scheduled = await source("../features/integrationPlatform/dataConnectionScheduledSyncService.js");

  assert.match(
    scheduled,
    /MarketingDataSource\.findOne\(\{[\s\S]*business:\s*businessId[\s\S]*location:\s*locationId/
  );
  assert.match(scheduled, /source\.checkpoint\?\.watermark/);
  assert.match(scheduled, /refreshSince:\s*hasWatermark \? isoDate\(watermark\) : ""/);
  assert.match(scheduled, /runMarketingDataSource/);
  assert.match(scheduled, /\{ businessId, locationId, actor \}/);
  assert.match(scheduled, /readOnly:\s*true/);
});

test("historical backfill is bounded, adaptive and preserves the incremental watermark", async () => {
  const backfill = await source("../features/integrationPlatform/dataConnectionBackfillService.js");

  assert.match(backfill, /const MAX_BACKFILL_DAYS = 366/);
  assert.match(backfill, /const MAX_REQUESTS_PER_OPERATION = 120/);
  assert.match(backfill, /reserveDataConnectionApiRequest\(\)/);
  assert.match(backfill, /const halves = split\(current\)/);
  assert.match(backfill, /saturatedDays\.push\(iso\(current\.start\)\)/);
  assert.match(backfill, /DATA_CONNECTION_BACKFILL_OPERATION_BUDGET_EXHAUSTED/);
  assert.match(backfill, /const originalWatermark = source\.checkpoint\?\.watermark/);
  assert.match(backfill, /checkpoint:\s*\{ watermark: originalWatermark \}/);
  assert.match(backfill, /complete:\s*saturatedDays\.length === 0/);
  assert.match(backfill, /one-day windows reached the configured row cap/i);
});
