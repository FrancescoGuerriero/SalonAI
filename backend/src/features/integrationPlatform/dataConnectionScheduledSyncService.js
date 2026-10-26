import mongoose from "mongoose";

import MarketingDataSource from "../../models/MarketingDataSource.js";
import { createServiceError } from "../../shared/serviceError.js";
import { runMarketingDataSource } from "./marketingDataCoreService.js";
import { previewDataConnection } from "./dataConnectionGatewayService.js";
import { reserveDataConnectionApiRequest } from "./dataConnectionRateBudgetService.js";

const MAX_SYNC_ROWS = 100;

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "records", "rows", "result", "results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function isoDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
}

function fieldsFor(source) {
  const configured = Array.isArray(source?.sourceConfig?.dataConnectionFields)
    ? source.sourceConfig.dataConnectionFields.filter(Boolean)
    : [];
  if (configured.length) return configured.slice(0, 50);
  return (source?.fieldCatalogue || [])
    .map((field) => field.sourceField)
    .filter((field) => field && !["account_id", "account_name"].includes(field))
    .slice(0, 50);
}

export function isManagedDataConnectionSource(source) {
  return source?.provider === "generic" && source?.sourceConfig?.managedBy === "aiibp_data_connections";
}

export async function runManagedDataConnectionSource(
  sourceId,
  { businessId, locationId, actor = null } = {}
) {
  objectId(sourceId, "source");
  objectId(businessId, "business");
  objectId(locationId, "location");

  const source = await MarketingDataSource.findOne({
    _id: sourceId,
    business: businessId,
    location: locationId,
    provider: "generic",
    "sourceConfig.managedBy": "aiibp_data_connections",
  });
  if (!source) throw createServiceError("AIIBP Data Hub source was not found for this location.", 404);
  if (["paused", "archived"].includes(source.status)) {
    throw createServiceError("Paused or archived data sources cannot run.", 409);
  }

  const dateTo = new Date();
  const watermark = source.checkpoint?.watermark ? new Date(source.checkpoint.watermark) : null;
  const hasWatermark = watermark && !Number.isNaN(watermark.getTime());
  await reserveDataConnectionApiRequest();
  const result = await previewDataConnection({
    connectorId: source.sourceConfig?.dataConnectionConnectorId,
    accountId: source.sourceConfig?.dataConnectionAccountId,
    fields: fieldsFor(source),
    datePreset: source.sourceConfig?.datePreset || "last_7d",
    dateFrom: hasWatermark ? isoDate(watermark) : "",
    dateTo: isoDate(dateTo),
    limit: Math.min(Math.max(Number(source.sourceConfig?.importLimit) || MAX_SYNC_ROWS, 1), MAX_SYNC_ROWS),
    refreshSince: hasWatermark ? isoDate(watermark) : "",
  });

  const records = recordsFromPayload(result);
  if (!records.length) {
    source.lastSyncAt = new Date();
    source.lastSuccessAt = source.lastSyncAt;
    source.lastError = "";
    source.checkpoint = {
      cursor: source.checkpoint?.cursor || "",
      watermark: dateTo,
      updatedAt: new Date(),
    };
    await source.save();
    return {
      sourceId: source._id,
      status: "succeeded",
      skipped: true,
      importedRecords: 0,
      counters: { fetched: 0, rawStored: 0, normalised: 0, reconciled: 0, failed: 0 },
    };
  }

  const run = await runMarketingDataSource(
    source._id,
    {
      mode: source.syncMode === "scheduled" ? "scheduled" : "incremental",
      records,
      start: hasWatermark ? watermark : undefined,
      end: dateTo,
      checkpoint: { watermark: dateTo },
    },
    { businessId, locationId, actor }
  );

  return {
    sourceId: source._id,
    runId: run._id,
    status: run.status,
    importedRecords: records.length,
    counters: run.counters,
    readOnly: true,
  };
}

export default { isManagedDataConnectionSource, runManagedDataConnectionSource };
