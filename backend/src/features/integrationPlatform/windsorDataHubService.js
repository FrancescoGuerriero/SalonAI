import { createHash } from "node:crypto";
import mongoose from "mongoose";

import MarketingDataSource from "../../models/MarketingDataSource.js";
import { createServiceError } from "../../shared/serviceError.js";
import { runMarketingDataSource } from "./marketingDataCoreService.js";
import { previewWindsorData } from "./windsorConnectorService.js";

const CADENCES = new Set(["manual", "hourly", "daily", "weekly"]);

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function actorId(actor) {
  const value = actor?._id || actor?.id || actor;
  return mongoose.isValidObjectId(value) ? value : null;
}

function safe(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cadence(value) {
  const result = safe(value || "manual", 20).toLowerCase();
  if (!CADENCES.has(result)) throw createServiceError("Invalid Windsor sync cadence.", 400);
  return result;
}

function nextRunAt(value) {
  if (value === "manual") return null;
  const ms = value === "hourly" ? 3600000 : value === "weekly" ? 7 * 86400000 : 86400000;
  return new Date(Date.now() + ms);
}

function keySuffix(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "records", "rows", "result", "results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function inferType(value, fieldName) {
  if (fieldName === "date") return "date";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return "string";
}

function inferRole(fieldName, value) {
  if (fieldName === "account_id") return "identifier";
  if (fieldName === "date" || /(_at|timestamp|datetime)$/i.test(fieldName)) return "timestamp";
  if (typeof value === "number") return "metric";
  if (fieldName === "account_name" || /(_name|status|type|country|currency|channel)$/i.test(fieldName)) return "dimension";
  return "attribute";
}

function fieldCatalogue(fields, records) {
  const first = records.find((record) => record && typeof record === "object" && !Array.isArray(record)) || {};
  const names = [...new Set([
    ...(Array.isArray(fields) ? fields : []),
    ...Object.keys(first),
    "account_id",
    "account_name",
  ].map((value) => safe(value, 160)).filter(Boolean))].slice(0, 200);

  return names.map((sourceField) => {
    const value = first[sourceField];
    return {
      sourceField,
      label: sourceField.replaceAll("_", " "),
      dataType: inferType(value, sourceField),
      role: inferRole(sourceField, value),
      normalisedField: sourceField,
      required: sourceField === "account_id",
      description: "Windsor connector field.",
    };
  });
}

export async function ensureWindsorDataSource({
  connection,
  connectorId,
  productKey,
  productLabel,
  accountId,
  accountName,
  fields = [],
  records = [],
  datePreset = "last_7d",
  limit = 100,
  syncCadence = "manual",
  timezone = "Europe/London",
  businessId,
  locationId,
  actor = null,
}) {
  objectId(businessId, "business");
  objectId(locationId, "location");
  if (!connection?._id || !connection?.app) {
    throw createServiceError("Windsor integration connection is required for Data Hub provisioning.", 409);
  }
  const configuredCadence = cadence(syncCadence);
  const key = `windsor-${safe(productKey, 60).toLowerCase()}-${keySuffix(accountId)}`;
  const catalogue = fieldCatalogue(fields, records);
  const values = {
    app: connection.app,
    connection: connection._id,
    name: `${safe(productLabel, 100)} — ${safe(accountName || accountId, 70)}`,
    provider: "generic",
    providerSchemaVersion: "windsor-1",
    status: "active",
    syncMode: configuredCadence === "manual" ? "manual" : "scheduled",
    schedule: {
      cadence: configuredCadence,
      timezone: safe(timezone, 80) || "Europe/London",
      nextRunAt: nextRunAt(configuredCadence),
    },
    fieldCatalogue: catalogue,
    sourceConfig: {
      managedBy: "windsor_marketing_connector",
      windsorConnectorId: safe(connectorId, 100),
      windsorProductKey: safe(productKey, 100),
      windsorAccountId: safe(accountId, 300),
      windsorFields: [...new Set((Array.isArray(fields) ? fields : []).map((field) => safe(field, 160)).filter(Boolean))].slice(0, 50),
      datePreset: safe(datePreset, 50) || "last_7d",
      importLimit: Math.min(Math.max(Number(limit) || 100, 1), 100),
      readOnly: true,
    },
    normalisationConfig: { mappingVersion: "windsor-1" },
    updatedBy: actorId(actor),
  };

  return MarketingDataSource.findOneAndUpdate(
    { business: businessId, location: locationId, key },
    {
      $set: values,
      $setOnInsert: {
        business: businessId,
        location: locationId,
        key,
        createdBy: actorId(actor),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function importWindsorAccountToDataHub({
  connection,
  connectorId,
  productKey,
  productLabel,
  accountId,
  accountName,
  fields = [],
  datePreset = "last_7d",
  limit = 100,
  syncCadence = "manual",
  timezone = "Europe/London",
  businessId,
  locationId,
  actor = null,
}) {
  const result = await previewWindsorData({
    connectorId,
    accountId,
    fields,
    datePreset,
    limit: Math.min(Math.max(Number(limit) || 100, 1), 100),
  });
  const records = recordsFromPayload(result);
  if (!records.length) {
    throw createServiceError("Windsor returned no records for the selected account/window.", 409, {
      code: "WINDSOR_NO_RECORDS",
    });
  }

  const source = await ensureWindsorDataSource({
    connection,
    connectorId,
    productKey,
    productLabel,
    accountId,
    accountName,
    fields,
    records,
    datePreset,
    limit,
    syncCadence,
    timezone,
    businessId,
    locationId,
    actor,
  });

  const run = await runMarketingDataSource(
    source._id,
    {
      mode: "manual",
      records,
      checkpoint: { watermark: new Date() },
    },
    { businessId, locationId, actor }
  );

  return {
    sourceId: source._id,
    sourceKey: source.key,
    sourceName: source.name,
    runId: run._id,
    status: run.status,
    counters: run.counters,
    importedRecords: records.length,
    datePreset,
    syncCadence: source.schedule?.cadence || "manual",
    nextRunAt: source.schedule?.nextRunAt || null,
    readOnly: true,
  };
}

export default {
  ensureWindsorDataSource,
  importWindsorAccountToDataHub,
};
