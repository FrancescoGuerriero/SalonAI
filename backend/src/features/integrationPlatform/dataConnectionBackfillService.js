import mongoose from "mongoose";

import MarketingDataSource from "../../models/MarketingDataSource.js";
import { createServiceError } from "../../shared/serviceError.js";
import { runMarketingDataSource } from "./marketingDataCoreService.js";
import { previewDataConnection } from "./dataConnectionGatewayService.js";
import { reserveDataConnectionApiRequest } from "./dataConnectionRateBudgetService.js";

const DAY_MS = 86_400_000;
const MAX_ROWS = 100;
const DEFAULT_SLICE_DAYS = 7;
const MAX_BACKFILL_DAYS = 366;
const MAX_REQUESTS_PER_OPERATION = 120;

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function dateOnly(value, field) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createServiceError(`${field} must use YYYY-MM-DD format.`, 400, { field });
  }
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw createServiceError(`${field} is invalid.`, 400, { field });
  return parsed;
}

function iso(value) {
  return value.toISOString().slice(0, 10);
}

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "records", "rows", "result", "results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function fieldsFor(source) {
  const configured = Array.isArray(source?.sourceConfig?.dataConnectionFields)
    ? source.sourceConfig.dataConnectionFields.filter(Boolean)
    : [];
  return configured.length
    ? configured.slice(0, 50)
    : (source?.fieldCatalogue || []).map((field) => field.sourceField).filter(Boolean).slice(0, 50);
}

function initialSlices(start, end, sliceDays) {
  const result = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const sliceEnd = new Date(Math.min(end.getTime(), cursor.getTime() + (sliceDays - 1) * DAY_MS));
    result.push({ start: new Date(cursor), end: sliceEnd });
    cursor = new Date(sliceEnd.getTime() + DAY_MS);
  }
  return result;
}

function split(slice) {
  const days = Math.floor((slice.end.getTime() - slice.start.getTime()) / DAY_MS) + 1;
  if (days <= 1) return null;
  const leftDays = Math.ceil(days / 2);
  const leftEnd = new Date(slice.start.getTime() + (leftDays - 1) * DAY_MS);
  return [
    { start: slice.start, end: leftEnd },
    { start: new Date(leftEnd.getTime() + DAY_MS), end: slice.end },
  ];
}

export async function runDataConnectionBackfill(
  sourceId,
  { dateFrom, dateTo, sliceDays = DEFAULT_SLICE_DAYS, actor = null } = {},
  { businessId, locationId } = {}
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
    throw createServiceError("Paused or archived data sources cannot backfill.", 409);
  }

  const start = dateOnly(dateFrom, "dateFrom");
  const end = dateOnly(dateTo, "dateTo");
  if (start > end) throw createServiceError("dateFrom must be on or before dateTo.", 400);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (totalDays > MAX_BACKFILL_DAYS) {
    throw createServiceError(`A single backfill is limited to ${MAX_BACKFILL_DAYS} days.`, 400, {
      code: "DATA_CONNECTION_BACKFILL_WINDOW_TOO_LARGE",
    });
  }

  const requestedSliceDays = Math.max(1, Math.min(Number(sliceDays) || DEFAULT_SLICE_DAYS, 31));
  const queue = initialSlices(start, end, requestedSliceDays);
  const originalWatermark = source.checkpoint?.watermark ? new Date(source.checkpoint.watermark) : new Date();
  const results = [];
  const saturatedDays = [];
  let requests = 0;
  let importedRecords = 0;

  while (queue.length) {
    if (requests >= MAX_REQUESTS_PER_OPERATION) {
      throw createServiceError("Backfill request budget reached before the requested window completed.", 429, {
        code: "DATA_CONNECTION_BACKFILL_OPERATION_BUDGET_EXHAUSTED",
        maxRequests: MAX_REQUESTS_PER_OPERATION,
        completedSlices: results.length,
      });
    }

    const current = queue.shift();
    await reserveDataConnectionApiRequest();
    requests += 1;
    const payload = await previewDataConnection({
      connectorId: source.sourceConfig?.dataConnectionConnectorId,
      accountId: source.sourceConfig?.dataConnectionAccountId,
      fields: fieldsFor(source),
      dateFrom: iso(current.start),
      dateTo: iso(current.end),
      limit: MAX_ROWS,
    });
    const records = recordsFromPayload(payload);

    if (records.length >= MAX_ROWS) {
      const halves = split(current);
      if (halves) {
        queue.unshift(...halves);
        continue;
      }
      saturatedDays.push(iso(current.start));
    }

    if (!records.length) {
      results.push({ dateFrom: iso(current.start), dateTo: iso(current.end), records: 0, status: "empty" });
      continue;
    }

    const run = await runMarketingDataSource(
      source._id,
      {
        mode: "backfill",
        records,
        start: current.start,
        end: current.end,
        checkpoint: { watermark: originalWatermark },
      },
      { businessId, locationId, actor }
    );
    importedRecords += records.length;
    results.push({
      dateFrom: iso(current.start),
      dateTo: iso(current.end),
      records: records.length,
      runId: run._id,
      status: run.status,
    });
  }

  return {
    sourceId: source._id,
    dateFrom: iso(start),
    dateTo: iso(end),
    requests,
    importedRecords,
    slices: results,
    saturatedDays,
    complete: saturatedDays.length === 0,
    readOnly: true,
    note: saturatedDays.length
      ? "One or more one-day windows reached the configured row cap and require connector-specific follow-up before history is considered complete."
      : "Requested historical window completed without a one-day saturation signal.",
  };
}

export default { runDataConnectionBackfill };
