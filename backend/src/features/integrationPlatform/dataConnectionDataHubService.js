import { createHash } from "node:crypto";
import mongoose from "mongoose";

import MarketingDataSource from "../../models/MarketingDataSource.js";
import { createServiceError } from "../../shared/serviceError.js";
import { runMarketingDataSource } from "./marketingDataCoreService.js";
import { previewDataConnection } from "./dataConnectionGatewayService.js";
import { resolveDataConnectionFieldProfile } from "./dataConnectionFieldProfiles.js";
import { reserveDataConnectionApiRequest } from "./dataConnectionRateBudgetService.js";

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
  if (!CADENCES.has(result)) throw createServiceError("Invalid data sync cadence.", 400);
  return result;
}

function nextRunAt(value) {
  if (value === "manual") return null;
  const ms = value === "hourly" ? 3_600_000 : value === "weekly" ? 7 * 86_400_000 : 86_400_000;
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
  if (fieldName === "date" || /(_date|date_)$/i.test(fieldName)) return "date";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return "string";
}

function inferRole(fieldName, value) {
  if (fieldName === "account_id" || /(_id|__.*_id)$/i.test(fieldName)) return "identifier";
  if (fieldName === "date" || /(_at|timestamp|datetime|_time|_date)$/i.test(fieldName)) return "timestamp";
  if (typeof value === "number") return "metric";
  if (fieldName === "account_name" || /(_name|status|type|country|currency|channel|sku|asin)$/i.test(fieldName)) {
    return "dimension";
  }
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
      description: "AIIBP managed data connection field.",
    };
  });
}

function resolvedFields(productKey, fields, profileKey) {
  const supplied = [...new Set((Array.isArray(fields) ? fields : [])
    .map((field) => safe(field, 160)).filter(Boolean))].slice(0, 50);
  if (supplied.length) {
    return { fields: supplied, profile: resolveDataConnectionFieldProfile(productKey, profileKey) };
  }
  const profile = resolveDataConnectionFieldProfile(productKey, profileKey);
  return { fields: profile?.fields?.slice(0, 50) || [], profile };
}

export async function ensureDataConnectionSource({
  connection,
  connectorId,
  productKey,
  productLabel,
  accountId,
  accountName,
  fields = [],
  records = [],
  profileKey = "",
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
    throw createServiceError("AIIBP data connection is required for Data Hub provisioning.", 409);
  }

  const configuredCadence = cadence(syncCadence);
  const resolved = resolvedFields(productKey, fields, profileKey);
  const key = `data-connection-${safe(productKey, 60).toLowerCase()}-${keySuffix(accountId)}`;
  const values = {
    app: connection.app,
    connection: connection._id,
    name: `${safe(productLabel, 100)} — ${safe(accountName || accountId, 70)}`,
    provider: "generic",
    providerSchemaVersion: "aiibp-data-connections-v1",
    status: "active",
    syncMode: configuredCadence === "manual" ? "manual" : "scheduled",
    schedule: {
      cadence: configuredCadence,
      timezone: safe(timezone, 80) || "Europe/London",
      nextRunAt: nextRunAt(configuredCadence),
    },
    fieldCatalogue: fieldCatalogue(resolved.fields, records),
    sourceConfig: {
      managedBy: "aiibp_data_connections",
      dataConnectionConnectorId: safe(connectorId, 100),
      dataConnectionProductKey: safe(productKey, 100),
      dataConnectionAccountId: safe(accountId, 300),
      dataConnectionFields: resolved.fields,
      profileKey: resolved.profile?.key || "custom",
      profileLabel: resolved.profile?.label || "Custom fields",
      datePreset: safe(datePreset, 50) || "last_7d",
      importLimit: Math.min(Math.max(Number(limit) || 100, 1), 100),
      readOnly: true,
    },
    normalisationConfig: { mappingVersion: "aiibp-data-connections-v1" },
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

export async function importDataConnectionAccountToDataHub({
  connection,
  connectorId,
  productKey,
  productLabel,
  accountId,
  accountName,
  fields = [],
  profileKey = "",
  datePreset = "last_7d",
  limit = 100,
  syncCadence = "manual",
  timezone = "Europe/London",
  businessId,
  locationId,
  actor = null,
}) {
  const resolved = resolvedFields(productKey, fields, profileKey);
  await reserveDataConnectionApiRequest();
  const result = await previewDataConnection({
    connectorId,
    accountId,
    fields: resolved.fields,
    datePreset,
    limit: Math.min(Math.max(Number(limit) || 100, 1), 100),
  });
  const records = recordsFromPayload(result);
  if (!records.length) {
    throw createServiceError("The selected source returned no records for the requested account/window.", 409, {
      code: "DATA_CONNECTION_NO_RECORDS",
    });
  }

  const source = await ensureDataConnectionSource({
    connection,
    connectorId,
    productKey,
    productLabel,
    accountId,
    accountName,
    fields: resolved.fields,
    records,
    profileKey: resolved.profile?.key || profileKey,
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
    { mode: "manual", records, checkpoint: { watermark: new Date() } },
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
    profileKey: source.sourceConfig?.profileKey || "custom",
    syncCadence: source.schedule?.cadence || "manual",
    nextRunAt: source.schedule?.nextRunAt || null,
    readOnly: true,
  };
}

export default { ensureDataConnectionSource, importDataConnectionAccountToDataHub };
