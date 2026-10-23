import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";

import ConnectorHealth from "../../models/ConnectorHealth.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import MarketingDataSource from "../../models/MarketingDataSource.js";
import MarketingNormalisedRecord from "../../models/MarketingNormalisedRecord.js";
import MarketingRawRecord from "../../models/MarketingRawRecord.js";
import MarketingSyncRun from "../../models/MarketingSyncRun.js";
import SeoPageObservation from "../../models/SeoPageObservation.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  marketingConnectorCatalogue,
  marketingConnectorDefinition,
} from "./marketingConnectorCatalogue.js";
import { crawlTechnicalSeo } from "./technicalSeoCrawler.js";

const SOURCE_STATUSES = ["draft", "ready", "active", "paused", "degraded", "error", "archived"];
const SYNC_MODES = ["preview", "manual", "scheduled", "incremental", "backfill", "seo_scan"];
const SYNC_CADENCES = ["manual", "hourly", "daily", "weekly"];
const FORBIDDEN_CONFIG_KEY = /(secret|password|access[_-]?token|refresh[_-]?token|api[_-]?key|credential|private[_-]?key)/i;

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function slug(value) {
  return text(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function actorId(actor) {
  const value = actor?._id || actor?.id || actor;
  return mongoose.isValidObjectId(value) ? value : null;
}

function enumValue(value, field, allowed, fallback) {
  const normalised = text(value || fallback, 80).toLowerCase().replaceAll("-", "_");
  if (!allowed.includes(normalised)) {
    throw createServiceError(`${field} must be one of: ${allowed.join(", ")}.`, 400, { field });
  }
  return normalised;
}

function safeDate(value, field, { optional = true } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw createServiceError(`${field} must be a valid date.`, 400, { field });
  return parsed;
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function assertNoSecrets(value, path = "sourceConfig") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_CONFIG_KEY.test(key)) {
      throw createServiceError(`Secrets are not accepted in ${path}; store credentials in IntegrationApp credential versions.`, 422, {
        field: `${path}.${key}`,
      });
    }
    if (nested && typeof nested === "object") assertNoSecrets(nested, `${path}.${key}`);
  }
}

function normaliseFieldCatalogue(fields, provider) {
  const definition = marketingConnectorDefinition(provider);
  const supplied = Array.isArray(fields) && fields.length ? fields : definition.defaultFields;
  const seen = new Set();
  return supplied.map((field) => {
    const sourceField = text(field?.sourceField, 160);
    if (!sourceField) throw createServiceError("Every field catalogue entry requires sourceField.", 422);
    if (seen.has(sourceField)) throw createServiceError(`Duplicate field catalogue entry: ${sourceField}.`, 422);
    seen.add(sourceField);
    return {
      sourceField,
      label: text(field?.label, 180),
      dataType: enumValue(field?.dataType, "dataType", ["string", "number", "boolean", "date", "datetime", "object", "array"], "string"),
      role: enumValue(field?.role, "role", ["identifier", "dimension", "metric", "timestamp", "attribute", "ignored"], "attribute"),
      normalisedField: text(field?.normalisedField, 160),
      required: Boolean(field?.required),
      description: text(field?.description, 500),
    };
  });
}

function valueAtPath(record, path) {
  return String(path || "").split(".").reduce((value, segment) =>
    value && typeof value === "object" ? value[segment] : undefined, record);
}

function serialisableValue(value, dataType) {
  if (value === undefined) return undefined;
  if (dataType === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  if (dataType === "boolean") return Boolean(value);
  if (dataType === "date" || dataType === "datetime") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return value;
}

function recordHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function externalIdFor(record, fields) {
  const identifiers = fields.filter((field) => field.role === "identifier");
  const candidate = identifiers.map((field) => valueAtPath(record, field.sourceField)).filter((value) => value !== undefined && value !== null && value !== "").join("|");
  return text(candidate || record.id || record._id || record.externalId || recordHash(record), 500);
}

function normaliseRecord(record, source, rawRecord) {
  const connector = marketingConnectorDefinition(source.provider);
  const dimensions = {};
  const metrics = {};
  const attributes = {};
  let occurredAt = null;

  for (const field of source.fieldCatalogue || []) {
    if (field.role === "ignored") continue;
    const rawValue = valueAtPath(record, field.sourceField);
    if (field.required && (rawValue === undefined || rawValue === null || rawValue === "")) {
      throw createServiceError(`Required source field is missing: ${field.sourceField}.`, 422);
    }
    const value = serialisableValue(rawValue, field.dataType);
    if (value === undefined) continue;
    const key = field.normalisedField || field.sourceField;
    if (field.role === "metric") metrics[key] = value;
    else if (field.role === "dimension") dimensions[key] = value;
    else if (field.role === "timestamp") occurredAt = value instanceof Date ? value : safeDate(value, key);
    else if (field.role !== "identifier") attributes[key] = value;
  }

  return {
    entityType: connector.entityType,
    externalId: rawRecord.externalId,
    occurredAt,
    schemaVersion: connector.schemaVersion,
    dimensions,
    metrics,
    attributes,
    lineage: {
      provider: source.provider,
      sourceKey: source.key,
      rawPayloadHash: rawRecord.payloadHash,
      providerSchemaVersion: source.providerSchemaVersion,
      mappingVersion: text(source.normalisationConfig?.mappingVersion, 40) || "1.0.0",
    },
  };
}

async function appForBusiness(appId, businessId) {
  objectId(appId, "app");
  return IntegrationApp.findOne({ _id: appId, business: businessId });
}

async function sourceForBusiness(sourceId, businessId) {
  objectId(sourceId, "source");
  const source = await MarketingDataSource.findOne({ _id: sourceId, business: businessId });
  if (!source) throw createServiceError("Marketing data source not found.", 404);
  return source;
}

async function updateHealth(source, businessId, status, values = {}) {
  return ConnectorHealth.findOneAndUpdate(
    { business: businessId, app: source.app, componentKey: `marketing-source:${source._id}` },
    {
      $set: {
        connection: source.connection || null,
        status,
        lastSuccessAt: values.lastSuccessAt ?? undefined,
        lastFailureAt: values.lastFailureAt ?? undefined,
        lastError: values.lastError ?? "",
        retryAt: values.retryAt ?? null,
        metrics: values.metrics || {},
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export function marketingDataConnectorCatalogue() {
  return marketingConnectorCatalogue();
}

export async function createMarketingDataSource(payload = {}, { businessId, actor = null } = {}) {
  objectId(businessId, "business");
  const provider = text(payload.provider, 80).toLowerCase();
  const definition = marketingConnectorDefinition(provider);
  const app = await appForBusiness(payload.app, businessId);
  if (!app) throw createServiceError("Integration app not found for this business.", 404);

  let connection = null;
  if (payload.connection) {
    objectId(payload.connection, "connection");
    connection = await IntegrationConnection.findOne({ _id: payload.connection, business: businessId, app: app._id });
    if (!connection) throw createServiceError("Integration connection does not belong to this app.", 409);
  }

  const name = text(payload.name, 180);
  const key = slug(payload.key || name);
  if (!name || !key) throw createServiceError("Source name is required.", 422);
  const sourceConfig = safeObject(payload.sourceConfig);
  assertNoSecrets(sourceConfig);

  const source = await MarketingDataSource.create({
    business: businessId,
    app: app._id,
    connection: connection?._id || null,
    key,
    name,
    provider,
    providerSchemaVersion: definition.schemaVersion,
    status: enumValue(payload.status, "status", SOURCE_STATUSES, "draft"),
    syncMode: enumValue(payload.syncMode, "syncMode", ["manual", "scheduled", "incremental"], "manual"),
    schedule: {
      cadence: enumValue(payload.schedule?.cadence, "schedule.cadence", SYNC_CADENCES, "manual"),
      timezone: text(payload.schedule?.timezone, 80) || "Europe/London",
      nextRunAt: safeDate(payload.schedule?.nextRunAt, "schedule.nextRunAt"),
    },
    fieldCatalogue: normaliseFieldCatalogue(payload.fieldCatalogue, provider),
    sourceConfig,
    normalisationConfig: safeObject(payload.normalisationConfig),
    createdBy: actorId(actor),
    updatedBy: actorId(actor),
  });

  await updateHealth(source, businessId, connection?.status === "connected" || provider === "technical_seo" ? "healthy" : "unknown", {
    metrics: { sourceStatus: source.status, provider, catalogueVersion: definition.schemaVersion },
  });
  return source;
}

export async function listMarketingDataSources(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.provider) match.provider = text(query.provider, 80).toLowerCase();
  if (query.status) match.status = enumValue(query.status, "status", SOURCE_STATUSES, "active");
  return MarketingDataSource.find(match)
    .populate("app", "key name environment status scopes ratePolicy")
    .populate("connection", "provider connectionKey status scopes tokenExpiresAt")
    .sort({ name: 1, _id: 1 })
    .lean();
}

export async function updateMarketingDataSource(sourceId, payload = {}, { businessId, actor = null } = {}) {
  const source = await sourceForBusiness(sourceId, businessId);
  if (payload.name !== undefined) source.name = text(payload.name, 180);
  if (payload.status !== undefined) source.status = enumValue(payload.status, "status", SOURCE_STATUSES, source.status);
  if (payload.syncMode !== undefined) source.syncMode = enumValue(payload.syncMode, "syncMode", ["manual", "scheduled", "incremental"], source.syncMode);
  if (payload.schedule !== undefined) {
    source.schedule = {
      cadence: enumValue(payload.schedule?.cadence, "schedule.cadence", SYNC_CADENCES, source.schedule?.cadence || "manual"),
      timezone: text(payload.schedule?.timezone, 80) || source.schedule?.timezone || "Europe/London",
      nextRunAt: safeDate(payload.schedule?.nextRunAt, "schedule.nextRunAt"),
    };
  }
  if (payload.fieldCatalogue !== undefined) source.fieldCatalogue = normaliseFieldCatalogue(payload.fieldCatalogue, source.provider);
  if (payload.sourceConfig !== undefined) {
    const sourceConfig = safeObject(payload.sourceConfig);
    assertNoSecrets(sourceConfig);
    source.sourceConfig = sourceConfig;
  }
  if (payload.normalisationConfig !== undefined) source.normalisationConfig = safeObject(payload.normalisationConfig);
  source.updatedBy = actorId(actor);
  await source.save();
  return source;
}

export async function previewMarketingData(sourceId, payload = {}, { businessId } = {}) {
  const source = await sourceForBusiness(sourceId, businessId);
  const records = Array.isArray(payload.records) ? payload.records.slice(0, 25) : [];
  if (!records.length) throw createServiceError("Preview requires one or more sample records.", 422);
  source.lastPreviewAt = new Date();
  await source.save();

  return {
    provider: source.provider,
    schemaVersion: source.providerSchemaVersion,
    fieldCatalogue: source.fieldCatalogue,
    records: records.map((record) => {
      const payloadHash = recordHash(record);
      const raw = { externalId: externalIdFor(record, source.fieldCatalogue), payloadHash };
      return { raw: record, normalised: normaliseRecord(record, source, raw) };
    }),
  };
}

async function persistBatch(source, run, records, businessId) {
  const counters = { fetched: records.length, rawStored: 0, normalised: 0, reconciled: 0, failed: 0 };
  const errors = [];

  for (const record of records) {
    let raw = null;
    try {
      const externalId = externalIdFor(record, source.fieldCatalogue);
      const payloadHash = recordHash(record);
      raw = await MarketingRawRecord.findOne({ business: businessId, source: source._id, externalId, payloadHash });

      if (raw) {
        const existingNormalised = await MarketingNormalisedRecord.findOne({
          business: businessId,
          source: source._id,
          rawRecord: raw._id,
        }).select("_id").lean();

        if (raw.reconciliationStatus === "normalised" || existingNormalised) {
          if (raw.reconciliationStatus !== "normalised") {
            raw.reconciliationStatus = "normalised";
            raw.reconciliationMessage = "";
            raw.run = run._id;
            await raw.save();
          }
          counters.reconciled += 1;
          continue;
        }

        raw.run = run._id;
        raw.reconciliationStatus = "pending";
        raw.reconciliationMessage = "";
        await raw.save();
      } else {
        raw = await MarketingRawRecord.create({
          business: businessId,
          source: source._id,
          run: run._id,
          externalId,
          payloadHash,
          capturedAt: new Date(),
          sourceUpdatedAt: safeDate(record.updatedAt || record.modifiedAt, "sourceUpdatedAt"),
          schemaVersion: source.providerSchemaVersion,
          payload: record,
        });
        counters.rawStored += 1;
      }

      const normalised = normaliseRecord(record, source, raw);
      await MarketingNormalisedRecord.create({
        business: businessId,
        source: source._id,
        run: run._id,
        rawRecord: raw._id,
        ...normalised,
      });
      raw.reconciliationStatus = "normalised";
      raw.reconciliationMessage = "";
      await raw.save();
      counters.normalised += 1;
      counters.reconciled += 1;
    } catch (error) {
      counters.failed += 1;
      const message = text(error?.message || error, 500);
      errors.push(message);
      if (raw?._id) {
        await MarketingRawRecord.updateOne(
          { _id: raw._id, business: businessId, source: source._id },
          {
            $set: {
              run: run._id,
              reconciliationStatus: "failed",
              reconciliationMessage: message,
            },
          }
        ).catch(() => undefined);
      }
    }
  }
  return { counters, errors };
}

async function executeSeoScan(source, run, businessId, payload = {}) {
  const rootUrl = text(payload.rootUrl || source.sourceConfig?.rootUrl, 2000);
  if (!rootUrl) throw createServiceError("Technical SEO source requires sourceConfig.rootUrl or rootUrl.", 422);
  const result = await crawlTechnicalSeo(rootUrl, { maxPages: payload.maxPages || source.sourceConfig?.maxPages || 25 });

  await SeoPageObservation.insertMany(result.pages.map((page) => ({
    business: businessId,
    source: source._id,
    run: run._id,
    ...page,
  })), { ordered: false });

  const normalisable = result.pages.map((page) => ({
    id: page.url,
    url: page.url,
    statusCode: page.statusCode,
    title: page.title,
    metaDescription: page.metaDescription,
    canonicalUrl: page.canonicalUrl,
    noindex: page.noindex,
    scannedAt: new Date(),
    issues: page.issues,
  }));
  return { ...result, batch: await persistBatch(source, run, normalisable, businessId) };
}

export async function runMarketingDataSource(sourceId, payload = {}, { businessId, actor = null } = {}) {
  const source = await sourceForBusiness(sourceId, businessId);
  if (["paused", "archived"].includes(source.status)) throw createServiceError("Paused or archived sources cannot run.", 409);
  const mode = enumValue(payload.mode, "mode", SYNC_MODES, source.provider === "technical_seo" ? "seo_scan" : source.syncMode || "manual");
  const connector = marketingConnectorDefinition(source.provider);
  const run = await MarketingSyncRun.create({
    business: businessId,
    source: source._id,
    runKey: `${source.key}:${randomUUID()}`,
    mode,
    status: "running",
    schemaVersion: connector.schemaVersion,
    requestedWindow: {
      start: safeDate(payload.start, "start"),
      end: safeDate(payload.end, "end"),
    },
    checkpointBefore: source.checkpoint?.toObject ? source.checkpoint.toObject() : source.checkpoint || {},
    attempt: Math.max(1, Number(payload.attempt) || 1),
    retryOf: mongoose.isValidObjectId(payload.retryOf) ? payload.retryOf : null,
    startedAt: new Date(),
    requestedBy: actorId(actor),
  });

  try {
    let batch;
    if (source.provider === "technical_seo") {
      const seo = await executeSeoScan(source, run, businessId, payload);
      batch = seo.batch;
    } else {
      const records = Array.isArray(payload.records) ? payload.records.slice(0, 5000) : [];
      if (!records.length) {
        throw createServiceError(
          `${connector.label} live retrieval is not activated. Supply adapter records for source-level ingestion or activate an approved provider connection later.`,
          409,
          { code: "LIVE_CONNECTOR_NOT_ACTIVATED", provider: source.provider }
        );
      }
      batch = await persistBatch(source, run, records, businessId);
    }

    run.counters = batch.counters;
    run.status = batch.counters.failed ? (batch.counters.normalised || batch.counters.reconciled ? "partial" : "failed") : "succeeded";
    run.failureCode = batch.counters.failed ? "RECORD_RECONCILIATION_FAILURE" : "";
    run.failureMessage = batch.errors?.slice(0, 5).join(" | ") || "";
    run.completedAt = new Date();

    const checkpoint = safeObject(payload.checkpoint);
    source.checkpoint = {
      cursor: text(checkpoint.cursor ?? source.checkpoint?.cursor, 2000),
      watermark: safeDate(checkpoint.watermark ?? payload.end ?? new Date(), "checkpoint.watermark"),
      updatedAt: new Date(),
    };
    run.checkpointAfter = source.checkpoint.toObject ? source.checkpoint.toObject() : source.checkpoint;
    source.lastSyncAt = new Date();
    source.updatedBy = actorId(actor);
    if (run.status === "succeeded") {
      source.status = source.status === "draft" ? "ready" : source.status;
      source.lastSuccessAt = new Date();
      source.lastError = "";
    } else {
      source.status = "degraded";
      source.lastFailureAt = new Date();
      source.lastError = run.failureMessage;
    }
    await Promise.all([run.save(), source.save()]);
    await updateHealth(source, businessId, run.status === "succeeded" ? "healthy" : "degraded", {
      lastSuccessAt: run.status === "succeeded" ? run.completedAt : source.lastSuccessAt,
      lastFailureAt: run.status !== "succeeded" ? run.completedAt : source.lastFailureAt,
      lastError: run.failureMessage,
      metrics: { ...batch.counters, runId: run._id, provider: source.provider, schemaVersion: run.schemaVersion },
    });
    return run;
  } catch (error) {
    run.status = "failed";
    run.failureCode = text(error?.code || "SYNC_FAILED", 120);
    run.failureMessage = text(error?.message || error, 2000);
    run.completedAt = new Date();
    run.nextRetryAt = payload.retry ? new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.min(run.attempt - 1, 7)) * 1000) : null;
    source.status = "error";
    source.lastSyncAt = new Date();
    source.lastFailureAt = run.completedAt;
    source.lastError = run.failureMessage;
    await Promise.all([run.save(), source.save()]);
    await updateHealth(source, businessId, "error", {
      lastFailureAt: run.completedAt,
      lastError: run.failureMessage,
      retryAt: run.nextRetryAt,
      metrics: { failedRunId: run._id, provider: source.provider, schemaVersion: run.schemaVersion },
    });
    throw error;
  }
}

export async function listMarketingSyncRuns(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.source) match.source = objectId(query.source, "source");
  if (query.status) match.status = text(query.status, 40).toLowerCase();
  return MarketingSyncRun.find(match).populate("source", "key name provider status").sort({ createdAt: -1 }).limit(200).lean();
}

export async function listSeoObservations(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.source) match.source = objectId(query.source, "source");
  if (query.run) match.run = objectId(query.run, "run");
  return SeoPageObservation.find(match).sort({ scannedAt: -1, url: 1 }).limit(500).lean();
}

export async function marketingDataOverview({ businessId } = {}) {
  objectId(businessId, "business");
  const [sources, recentRuns, health] = await Promise.all([
    MarketingDataSource.find({ business: businessId }).sort({ name: 1 }).lean(),
    MarketingSyncRun.find({ business: businessId }).populate("source", "key name provider").sort({ createdAt: -1 }).limit(25).lean(),
    ConnectorHealth.find({ business: businessId, componentKey: /^marketing-source:/ }).sort({ updatedAt: -1 }).lean(),
  ]);
  return {
    catalogue: marketingConnectorCatalogue(),
    sources,
    recentRuns,
    health,
    summary: {
      sources: sources.length,
      active: sources.filter((source) => source.status === "active").length,
      degradedOrError: sources.filter((source) => ["degraded", "error"].includes(source.status)).length,
      recentFailures: recentRuns.filter((run) => run.status === "failed").length,
    },
  };
}

export default {
  createMarketingDataSource,
  listMarketingDataSources,
  listMarketingSyncRuns,
  listSeoObservations,
  marketingDataConnectorCatalogue,
  marketingDataOverview,
  previewMarketingData,
  runMarketingDataSource,
  updateMarketingDataSource,
};