import { createHash } from "node:crypto";
import mongoose from "mongoose";

import DataHubDestinationRun from "../../models/DataHubDestinationRun.js";
import DataHubDestinationTask, {
  DATA_HUB_DESTINATION_TYPES,
} from "../../models/DataHubDestinationTask.js";
import DataHubSavedView from "../../models/DataHubSavedView.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import MarketingDataSource from "../../models/MarketingDataSource.js";
import MarketingNormalisedRecord from "../../models/MarketingNormalisedRecord.js";
import { createServiceError } from "../../shared/serviceError.js";
import { marketingDataConnectorCatalogue } from "./marketingDataCoreService.js";

export const DATA_HUB_CONTRACT_VERSION = "1.0.0";
export const DATA_HUB_QUERY_SCAN_LIMIT = 5000;

const ENTITY_TYPES = [
  "analytics_event",
  "search_performance",
  "seo_page",
  "generic_record",
];
const DATE_GRAINS = ["none", "day", "week", "month"];
const VIEW_STATUSES = ["draft", "active", "archived"];
const DESTINATION_STATUSES = ["draft", "ready", "active", "paused", "error", "archived"];
const DESTINATION_CADENCES = ["manual", "hourly", "daily", "weekly"];
const DESTINATION_FORMATS = ["json", "csv", "table"];
const DESTINATION_WRITE_MODES = ["replace", "append", "upsert"];
const FILTER_OPERATORS = ["eq", "neq", "contains", "gt", "gte", "lt", "lte", "in", "not_in"];
const FORBIDDEN_CONFIG_KEY = /(secret|password|access[_-]?token|refresh[_-]?token|api[_-]?key|credential|private[_-]?key)/i;
const FIELD_REF_PATTERN = /^(?:dimensions|metrics|attributes)\.[A-Za-z0-9_-]{1,160}$|^(?:provider|sourceKey|entityType|occurredAt)$/;
const SPECIAL_FIELD_REFS = new Set(["provider", "sourceKey", "entityType", "occurredAt"]);

const CALCULATED_METRICS = Object.freeze({
  ctr: Object.freeze({ key: "ctr", label: "Click-through rate", numerator: "clicks", denominator: "impressions", multiplier: 100, unit: "percent" }),
  cpc: Object.freeze({ key: "cpc", label: "Cost per click", numerator: "spend", denominator: "clicks", multiplier: 1, unit: "currency" }),
  cpm: Object.freeze({ key: "cpm", label: "Cost per thousand impressions", numerator: "spend", denominator: "impressions", multiplier: 1000, unit: "currency" }),
  cpa: Object.freeze({ key: "cpa", label: "Cost per acquisition", numerator: "spend", denominator: "conversions", multiplier: 1, unit: "currency" }),
  roas: Object.freeze({ key: "roas", label: "Return on ad spend", numerator: "revenue", denominator: "spend", multiplier: 1, unit: "ratio" }),
  conversion_rate: Object.freeze({ key: "conversion_rate", label: "Conversion rate", numerator: "conversions", denominator: "clicks", multiplier: 100, unit: "percent" }),
});

const DESTINATION_LABELS = Object.freeze({
  google_sheets: "Google Sheets",
  excel: "Microsoft Excel",
  bigquery: "Google BigQuery",
  snowflake: "Snowflake",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  amazon_s3: "Amazon S3",
  azure_blob: "Azure Blob Storage",
  azure_sql: "Azure SQL",
  redshift: "Amazon Redshift",
  databricks: "Databricks",
  power_bi: "Microsoft Power BI",
  looker_studio: "Looker Studio",
  tableau: "Tableau",
  python: "Python / API client",
  mcp_ai: "AI / MCP evidence consumer",
});

const PLANNED_SOURCE_BLUEPRINTS = Object.freeze([
  ["google_ads", "Google Ads", "advertising"],
  ["meta_ads", "Meta Ads", "advertising"],
  ["linkedin_ads", "LinkedIn Ads", "advertising"],
  ["microsoft_ads", "Microsoft Advertising", "advertising"],
  ["tiktok_ads", "TikTok Ads", "advertising"],
  ["instagram_organic", "Instagram Organic", "social"],
  ["facebook_pages", "Facebook Pages", "social"],
  ["linkedin_pages", "LinkedIn Pages", "social"],
  ["google_business_profile", "Google Business Profile", "local"],
  ["shopify", "Shopify", "commerce"],
  ["stripe", "Stripe", "payments"],
  ["hubspot", "HubSpot", "crm"],
  ["mailchimp", "Mailchimp", "communications"],
  ["youtube_analytics", "YouTube Analytics", "social"],
].map(([key, label, category]) => Object.freeze({
  key,
  label,
  category,
  availability: "planned_adapter",
  credentialsRequired: true,
})));

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function slug(value) {
  return text(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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
  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return parsed;
}

function assertNoSecrets(value, path = "destinationConfig") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_CONFIG_KEY.test(key)) {
      throw createServiceError(
        `Secrets are not accepted in ${path}; store credentials in IntegrationApp credential versions.`,
        422,
        { field: `${path}.${key}` }
      );
    }
    if (nested && typeof nested === "object") assertNoSecrets(nested, `${path}.${key}`);
  }
}

function uniqueStrings(values, maxItems, maxLength = 180) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const item = text(value, maxLength);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= maxItems) break;
  }
  return result;
}

function fieldRef(value, defaultPrefix = null) {
  let candidate = text(value, 180);
  if (candidate && defaultPrefix && !candidate.includes(".") && !SPECIAL_FIELD_REFS.has(candidate)) {
    candidate = `${defaultPrefix}.${candidate}`;
  }
  if (!FIELD_REF_PATTERN.test(candidate)) {
    throw createServiceError(`Unsupported Data Hub field reference: ${candidate || value}.`, 400, {
      field: candidate || value,
    });
  }
  return candidate;
}

function outputFieldRef(value) {
  const candidate = text(value, 180);
  if (candidate === "dateBucket" || candidate === "recordCount" || CALCULATED_METRICS[candidate]) {
    return candidate;
  }
  return fieldRef(candidate);
}

function normaliseFieldRefs(values, defaultPrefix, maxItems = 20) {
  return uniqueStrings(values, maxItems).map((value) => fieldRef(value, defaultPrefix));
}

function normaliseCalculatedMetrics(values) {
  const supplied = uniqueStrings(values, 10, 80).map((value) => value.toLowerCase());
  for (const value of supplied) {
    if (!CALCULATED_METRICS[value]) {
      throw createServiceError(`Unsupported calculated metric: ${value}.`, 400, { field: "calculatedMetrics" });
    }
  }
  return supplied;
}

function normaliseFilters(values) {
  return (Array.isArray(values) ? values : []).slice(0, 20).map((filter) => ({
    field: fieldRef(filter?.field),
    operator: enumValue(filter?.operator, "filter.operator", FILTER_OPERATORS, "eq"),
    value: filter?.value ?? null,
  }));
}

export function normaliseDataHubQuery(payload = {}) {
  const sourceIds = uniqueStrings(payload.sourceIds, 50).map((value) => objectId(value, "sourceId"));
  const entityTypes = uniqueStrings(payload.entityTypes, 10, 80).map((value) =>
    enumValue(value, "entityType", ENTITY_TYPES, "generic_record"));
  const rollingDaysRaw = payload.dateRange?.rollingDays;
  const rollingDays = rollingDaysRaw === undefined || rollingDaysRaw === null || rollingDaysRaw === ""
    ? null
    : Math.min(3650, Math.max(1, Number.parseInt(rollingDaysRaw, 10) || 30));
  const from = safeDate(payload.dateRange?.from, "dateRange.from");
  const to = safeDate(payload.dateRange?.to, "dateRange.to");
  if (from && to && from > to) {
    throw createServiceError("dateRange.from must be before dateRange.to.", 400, { field: "dateRange" });
  }
  const rowLimit = Math.min(1000, Math.max(1, Number.parseInt(payload.rowLimit, 10) || 250));

  return {
    sourceIds,
    entityTypes,
    dateRange: { from, to, rollingDays },
    dateGrain: enumValue(payload.dateGrain, "dateGrain", DATE_GRAINS, "day"),
    dimensions: normaliseFieldRefs(payload.dimensions, "dimensions", 12),
    metrics: normaliseFieldRefs(payload.metrics, "metrics", 20),
    calculatedMetrics: normaliseCalculatedMetrics(payload.calculatedMetrics),
    filters: normaliseFilters(payload.filters),
    rowLimit,
  };
}

function queryDateRange(query, now = new Date()) {
  let from = query.dateRange?.from || null;
  let to = query.dateRange?.to || null;
  if (!from && query.dateRange?.rollingDays) {
    from = new Date(now.getTime() - query.dateRange.rollingDays * 86400000);
  }
  if (!from && !to) {
    from = new Date(now.getTime() - 30 * 86400000);
    to = now;
  }
  return { from, to };
}

function nestedValue(record, path) {
  if (path === "provider") return record?.lineage?.provider;
  if (path === "sourceKey") return record?.lineage?.sourceKey;
  if (path === "entityType") return record?.entityType;
  if (path === "occurredAt") return record?.occurredAt;
  return String(path || "")
    .split(".")
    .reduce((value, part) => value && typeof value === "object" ? value[part] : undefined, record);
}

function scalar(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function compareFilter(actual, operator, expected) {
  if (operator === "contains") {
    return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
  }
  if (operator === "in" || operator === "not_in") {
    const list = Array.isArray(expected) ? expected : String(expected ?? "").split(",").map((item) => item.trim());
    const included = list.map(String).includes(String(actual ?? ""));
    return operator === "in" ? included : !included;
  }
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  const numeric = Number.isFinite(actualNumber) && Number.isFinite(expectedNumber);
  const left = numeric ? actualNumber : String(actual ?? "");
  const right = numeric ? expectedNumber : String(expected ?? "");
  if (operator === "neq") return left !== right;
  if (operator === "gt") return left > right;
  if (operator === "gte") return left >= right;
  if (operator === "lt") return left < right;
  if (operator === "lte") return left <= right;
  return left === right;
}

function recordMatchesFilters(record, filters) {
  return filters.every((filter) => compareFilter(nestedValue(record, filter.field), filter.operator, filter.value));
}

function bucketDate(value, grain) {
  if (grain === "none") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "undated";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (grain === "month") return `${year}-${month}`;
  if (grain === "week") {
    const copy = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() - day + 1);
    return copy.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function metricName(field) {
  return String(field || "").replace(/^metrics\./, "");
}

function numericMetric(record, name) {
  const value = Number(record?.metrics?.[name]);
  return Number.isFinite(value) ? value : 0;
}

function calculatedMetricValue(key, aggregate) {
  const definition = CALCULATED_METRICS[key];
  const numerator = Number(aggregate[definition.numerator] || 0);
  const denominator = Number(aggregate[definition.denominator] || 0);
  if (!denominator) return 0;
  return (numerator / denominator) * definition.multiplier;
}

async function ownedSources(sourceIds, businessId) {
  const match = { business: businessId };
  if (sourceIds.length) match._id = { $in: sourceIds };
  const sources = await MarketingDataSource.find(match)
    .select("_id key name provider status providerSchemaVersion fieldCatalogue")
    .sort({ name: 1, _id: 1 })
    .lean();
  if (sourceIds.length && sources.length !== sourceIds.length) {
    throw createServiceError("One or more Data Hub sources do not belong to the active business.", 404);
  }
  return sources;
}

export async function queryDataHub(payload = {}, { businessId, now = new Date() } = {}) {
  objectId(businessId, "business");
  const query = normaliseDataHubQuery(payload);
  const sources = await ownedSources(query.sourceIds, businessId);
  const sourceIds = sources.map((source) => source._id);
  if (!sourceIds.length) {
    return {
      contractVersion: DATA_HUB_CONTRACT_VERSION,
      query,
      columns: [],
      rows: [],
      totals: {},
      evidence: {
        deterministic: true,
        recordsScanned: 0,
        recordsMatched: 0,
        truncatedScan: false,
        sources: [],
        generatedAt: now,
      },
    };
  }

  const dateRange = queryDateRange(query, now);
  const match = { business: businessId, source: { $in: sourceIds } };
  if (query.entityTypes.length) match.entityType = { $in: query.entityTypes };
  if (dateRange.from || dateRange.to) {
    match.occurredAt = {};
    if (dateRange.from) match.occurredAt.$gte = dateRange.from;
    if (dateRange.to) match.occurredAt.$lte = dateRange.to;
  }

  const scanned = await MarketingNormalisedRecord.find(match)
    .sort({ occurredAt: 1, _id: 1 })
    .limit(DATA_HUB_QUERY_SCAN_LIMIT + 1)
    .lean();
  const truncatedScan = scanned.length > DATA_HUB_QUERY_SCAN_LIMIT;
  const records = scanned.slice(0, DATA_HUB_QUERY_SCAN_LIMIT).filter((record) =>
    recordMatchesFilters(record, query.filters));

  const calculatedDependencies = new Set();
  for (const key of query.calculatedMetrics) {
    calculatedDependencies.add(CALCULATED_METRICS[key].numerator);
    calculatedDependencies.add(CALCULATED_METRICS[key].denominator);
  }
  const selectedMetricNames = query.metrics.map(metricName);
  const aggregationMetricNames = Array.from(new Set([...selectedMetricNames, ...calculatedDependencies]));
  const groups = new Map();

  for (const record of records) {
    const dateBucket = bucketDate(record.occurredAt, query.dateGrain);
    const dimensionValues = Object.fromEntries(query.dimensions.map((field) => [field, scalar(nestedValue(record, field))]));
    const key = JSON.stringify([dateBucket, ...query.dimensions.map((field) => dimensionValues[field])]);
    if (!groups.has(key)) {
      groups.set(key, {
        dateBucket,
        dimensions: dimensionValues,
        metrics: Object.fromEntries(aggregationMetricNames.map((name) => [name, 0])),
        recordCount: 0,
      });
    }
    const group = groups.get(key);
    group.recordCount += 1;
    for (const name of aggregationMetricNames) {
      group.metrics[name] += numericMetric(record, name);
    }
  }

  const rows = Array.from(groups.values())
    .map((group) => ({
      dateBucket: group.dateBucket,
      dimensions: group.dimensions,
      metrics: Object.fromEntries(selectedMetricNames.map((name) => [name, group.metrics[name] || 0])),
      calculated: Object.fromEntries(query.calculatedMetrics.map((key) => [key, calculatedMetricValue(key, group.metrics)])),
      recordCount: group.recordCount,
    }))
    .slice(0, query.rowLimit);

  const totalsAggregate = Object.fromEntries(aggregationMetricNames.map((name) => [name, 0]));
  for (const record of records) {
    for (const name of aggregationMetricNames) totalsAggregate[name] += numericMetric(record, name);
  }
  const totals = {
    metrics: Object.fromEntries(selectedMetricNames.map((name) => [name, totalsAggregate[name] || 0])),
    calculated: Object.fromEntries(query.calculatedMetrics.map((key) => [key, calculatedMetricValue(key, totalsAggregate)])),
    recordCount: records.length,
  };

  const columns = [
    ...(query.dateGrain !== "none" ? [{ key: "dateBucket", kind: "date", label: query.dateGrain }] : []),
    ...query.dimensions.map((field) => ({ key: field, kind: "dimension", label: field.replace(/^dimensions\./, "") })),
    ...query.metrics.map((field) => ({ key: field, kind: "metric", label: metricName(field) })),
    ...query.calculatedMetrics.map((key) => ({ key, kind: "calculated_metric", label: CALCULATED_METRICS[key].label, unit: CALCULATED_METRICS[key].unit })),
  ];

  return {
    contractVersion: DATA_HUB_CONTRACT_VERSION,
    query: { ...query, dateRange },
    columns,
    rows,
    totals,
    evidence: {
      deterministic: true,
      recordsScanned: Math.min(scanned.length, DATA_HUB_QUERY_SCAN_LIMIT),
      recordsMatched: records.length,
      truncatedScan,
      rowLimitApplied: rows.length >= query.rowLimit,
      sources: sources.map((source) => ({
        id: source._id,
        key: source.key,
        name: source.name,
        provider: source.provider,
        providerSchemaVersion: source.providerSchemaVersion,
      })),
      providers: Array.from(new Set(sources.map((source) => source.provider))).sort(),
      generatedAt: now,
    },
  };
}

export async function dataHubFieldCatalogue({ businessId } = {}) {
  objectId(businessId, "business");
  const sources = await MarketingDataSource.find({ business: businessId })
    .select("_id key name provider status fieldCatalogue")
    .sort({ name: 1, _id: 1 })
    .lean();
  const fieldMap = new Map();
  const register = (entry) => {
    if (!fieldMap.has(entry.path)) fieldMap.set(entry.path, entry);
    else fieldMap.get(entry.path).sources.push(...entry.sources);
  };

  register({ path: "provider", label: "Provider", role: "dimension", dataType: "string", sources: [] });
  register({ path: "sourceKey", label: "Source", role: "dimension", dataType: "string", sources: [] });
  register({ path: "entityType", label: "Entity type", role: "dimension", dataType: "string", sources: [] });
  register({ path: "occurredAt", label: "Occurred at", role: "timestamp", dataType: "datetime", sources: [] });

  for (const source of sources) {
    for (const field of source.fieldCatalogue || []) {
      if (field.role === "ignored" || field.role === "identifier" || field.role === "timestamp") continue;
      const normalisedName = field.normalisedField || field.sourceField;
      const prefix = field.role === "metric" ? "metrics" : field.role === "dimension" ? "dimensions" : "attributes";
      const path = `${prefix}.${normalisedName}`;
      const existing = fieldMap.get(path);
      if (existing) {
        existing.sources.push({ id: source._id, key: source.key, provider: source.provider });
      } else {
        fieldMap.set(path, {
          path,
          label: field.label || normalisedName,
          role: field.role,
          dataType: field.dataType,
          description: field.description || "",
          sources: [{ id: source._id, key: source.key, provider: source.provider }],
        });
      }
    }
  }

  return {
    version: DATA_HUB_CONTRACT_VERSION,
    sources,
    fields: Array.from(fieldMap.values()).sort((a, b) => a.path.localeCompare(b.path)),
    calculatedMetrics: Object.values(CALCULATED_METRICS),
  };
}

export function dataHubCatalogue() {
  const stage5 = marketingDataConnectorCatalogue();
  return {
    version: DATA_HUB_CONTRACT_VERSION,
    sourceContractVersion: stage5.version,
    sourceConnectors: stage5.connectors.map((connector) => ({
      ...connector,
      availability: "source_contract",
    })),
    plannedSourceBlueprints: PLANNED_SOURCE_BLUEPRINTS,
    destinations: DATA_HUB_DESTINATION_TYPES.map((key) => ({
      key,
      label: DESTINATION_LABELS[key],
      availability: "preview_contract",
      liveExecutionAuthorised: false,
    })),
    calculatedMetrics: Object.values(CALCULATED_METRICS),
    queryLimits: {
      maxSourceCount: 50,
      maxDimensions: 12,
      maxMetrics: 20,
      maxFilters: 20,
      maxRows: 1000,
      maxRecordsScanned: DATA_HUB_QUERY_SCAN_LIMIT,
      defaultWindowDays: 30,
    },
    safety: {
      tenantScoped: true,
      deterministicQueries: true,
      externalSecretsInDestinationConfig: false,
      destinationExecutionAuthorised: false,
      aiActionsAuthorised: false,
    },
  };
}

export async function dataHubOverview({ businessId } = {}) {
  objectId(businessId, "business");
  const [sources, records, views, destinations, previews] = await Promise.all([
    MarketingDataSource.countDocuments({ business: businessId, status: { $ne: "archived" } }),
    MarketingNormalisedRecord.countDocuments({ business: businessId }),
    DataHubSavedView.countDocuments({ business: businessId, status: { $ne: "archived" } }),
    DataHubDestinationTask.countDocuments({ business: businessId, status: { $ne: "archived" } }),
    DataHubDestinationRun.countDocuments({ business: businessId, mode: "preview" }),
  ]);
  return {
    version: DATA_HUB_CONTRACT_VERSION,
    sources,
    normalisedRecords: records,
    savedViews: views,
    destinationTasks: destinations,
    destinationPreviews: previews,
    liveDestinationExecutionAuthorised: false,
  };
}

async function assertOwnedQuerySources(query, businessId) {
  await ownedSources(query.sourceIds, businessId);
}

export async function listDataHubSavedViews(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) match.status = enumValue(query.status, "status", VIEW_STATUSES, "active");
  return DataHubSavedView.find(match).sort({ updatedAt: -1, _id: -1 }).lean();
}

export async function createDataHubSavedView(payload = {}, { businessId, actor = null } = {}) {
  objectId(businessId, "business");
  const name = text(payload.name, 180);
  const key = slug(payload.key || name);
  if (!name || !key) throw createServiceError("Saved view name is required.", 422);
  const query = normaliseDataHubQuery(payload.query || {});
  await assertOwnedQuerySources(query, businessId);
  try {
    return await DataHubSavedView.create({
      business: businessId,
      key,
      name,
      description: text(payload.description, 1000),
      status: enumValue(payload.status, "status", VIEW_STATUSES, "draft"),
      query,
      createdBy: actorId(actor),
      updatedBy: actorId(actor),
    });
  } catch (error) {
    if (error?.code === 11000) throw createServiceError("A Data Hub saved view with this key already exists.", 409);
    throw error;
  }
}

async function savedViewForBusiness(viewId, businessId) {
  objectId(viewId, "view");
  const view = await DataHubSavedView.findOne({ _id: viewId, business: businessId });
  if (!view) throw createServiceError("Data Hub saved view not found.", 404);
  return view;
}

export async function updateDataHubSavedView(viewId, payload = {}, { businessId, actor = null } = {}) {
  const view = await savedViewForBusiness(viewId, businessId);
  if (payload.name !== undefined) view.name = text(payload.name, 180) || view.name;
  if (payload.description !== undefined) view.description = text(payload.description, 1000);
  if (payload.status !== undefined) view.status = enumValue(payload.status, "status", VIEW_STATUSES, view.status);
  if (payload.query !== undefined) {
    const query = normaliseDataHubQuery(payload.query || {});
    await assertOwnedQuerySources(query, businessId);
    view.query = query;
  }
  view.updatedBy = actorId(actor) || view.updatedBy;
  await view.save();
  return view;
}

export async function queryDataHubSavedView(viewId, { businessId, now = new Date() } = {}) {
  const view = await savedViewForBusiness(viewId, businessId);
  return queryDataHub(view.query?.toObject ? view.query.toObject() : view.query, { businessId, now });
}

async function optionalOwnedApp(appId, businessId) {
  if (!appId) return null;
  objectId(appId, "app");
  const app = await IntegrationApp.findOne({ _id: appId, business: businessId }).select("_id").lean();
  if (!app) throw createServiceError("Integration app not found in the active business.", 404);
  return app;
}

async function optionalOwnedConnection(connectionId, appId, businessId) {
  if (!connectionId) return null;
  objectId(connectionId, "connection");
  const match = { _id: connectionId, business: businessId };
  if (appId) match.app = appId;
  const connection = await IntegrationConnection.findOne(match).select("_id app").lean();
  if (!connection) throw createServiceError("Integration connection not found in the active business.", 404);
  return connection;
}

function normaliseFieldMapping(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).slice(0, 100).map((mapping) => {
    const sourceField = outputFieldRef(mapping?.sourceField);
    const destinationField = text(mapping?.destinationField, 180);
    if (!destinationField || !/^[A-Za-z0-9_.-]{1,180}$/.test(destinationField)) {
      throw createServiceError("Destination field names may only use letters, numbers, dot, dash and underscore.", 400);
    }
    if (seen.has(destinationField)) throw createServiceError(`Duplicate destination field: ${destinationField}.`, 400);
    seen.add(destinationField);
    return { sourceField, destinationField };
  });
}

export async function listDataHubDestinationTasks(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) match.status = enumValue(query.status, "status", DESTINATION_STATUSES, "active");
  if (query.type) match.type = enumValue(query.type, "type", DATA_HUB_DESTINATION_TYPES, "python");
  return DataHubDestinationTask.find(match)
    .populate("view", "key name status")
    .populate("app", "key name status")
    .populate("connection", "provider connectionKey status")
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
}

export async function createDataHubDestinationTask(payload = {}, { businessId, actor = null } = {}) {
  objectId(businessId, "business");
  const view = await savedViewForBusiness(payload.view, businessId);
  const app = await optionalOwnedApp(payload.app, businessId);
  const connection = await optionalOwnedConnection(payload.connection, app?._id || null, businessId);
  const name = text(payload.name, 180);
  const key = slug(payload.key || name);
  if (!name || !key) throw createServiceError("Destination task name is required.", 422);
  const destinationConfig = safeObject(payload.destinationConfig);
  assertNoSecrets(destinationConfig);

  try {
    return await DataHubDestinationTask.create({
      business: businessId,
      view: view._id,
      app: app?._id || null,
      connection: connection?._id || null,
      key,
      name,
      description: text(payload.description, 1000),
      type: enumValue(payload.type, "type", DATA_HUB_DESTINATION_TYPES, "python"),
      status: enumValue(payload.status, "status", DESTINATION_STATUSES, "draft"),
      format: enumValue(payload.format, "format", DESTINATION_FORMATS, "table"),
      writeMode: enumValue(payload.writeMode, "writeMode", DESTINATION_WRITE_MODES, "replace"),
      schedule: {
        cadence: enumValue(payload.schedule?.cadence, "schedule.cadence", DESTINATION_CADENCES, "manual"),
        timezone: text(payload.schedule?.timezone, 80) || "Europe/London",
        nextRunAt: safeDate(payload.schedule?.nextRunAt, "schedule.nextRunAt"),
      },
      destinationConfig,
      fieldMapping: normaliseFieldMapping(payload.fieldMapping),
      humanApprovalRequired: true,
      executionAuthorised: false,
      createdBy: actorId(actor),
      updatedBy: actorId(actor),
    });
  } catch (error) {
    if (error?.code === 11000) throw createServiceError("A Data Hub destination task with this key already exists.", 409);
    throw error;
  }
}

async function destinationTaskForBusiness(taskId, businessId) {
  objectId(taskId, "destination task");
  const task = await DataHubDestinationTask.findOne({ _id: taskId, business: businessId });
  if (!task) throw createServiceError("Data Hub destination task not found.", 404);
  return task;
}

export async function updateDataHubDestinationTask(taskId, payload = {}, { businessId, actor = null } = {}) {
  const task = await destinationTaskForBusiness(taskId, businessId);
  if (payload.view !== undefined) task.view = (await savedViewForBusiness(payload.view, businessId))._id;
  if (payload.name !== undefined) task.name = text(payload.name, 180) || task.name;
  if (payload.description !== undefined) task.description = text(payload.description, 1000);
  if (payload.type !== undefined) task.type = enumValue(payload.type, "type", DATA_HUB_DESTINATION_TYPES, task.type);
  if (payload.status !== undefined) task.status = enumValue(payload.status, "status", DESTINATION_STATUSES, task.status);
  if (payload.format !== undefined) task.format = enumValue(payload.format, "format", DESTINATION_FORMATS, task.format);
  if (payload.writeMode !== undefined) task.writeMode = enumValue(payload.writeMode, "writeMode", DESTINATION_WRITE_MODES, task.writeMode);
  if (payload.schedule !== undefined) {
    task.schedule.cadence = enumValue(payload.schedule?.cadence, "schedule.cadence", DESTINATION_CADENCES, task.schedule.cadence);
    task.schedule.timezone = text(payload.schedule?.timezone, 80) || task.schedule.timezone;
    task.schedule.nextRunAt = safeDate(payload.schedule?.nextRunAt, "schedule.nextRunAt");
  }
  if (payload.destinationConfig !== undefined) {
    const destinationConfig = safeObject(payload.destinationConfig);
    assertNoSecrets(destinationConfig);
    task.destinationConfig = destinationConfig;
  }
  if (payload.fieldMapping !== undefined) task.fieldMapping = normaliseFieldMapping(payload.fieldMapping);
  task.humanApprovalRequired = true;
  task.executionAuthorised = false;
  task.updatedBy = actorId(actor) || task.updatedBy;
  await task.save();
  return task;
}

function previewRows(result, task) {
  const mappings = Array.isArray(task.fieldMapping) ? task.fieldMapping : [];
  if (!mappings.length) return result.rows.slice(0, 100);
  return result.rows.slice(0, 100).map((row) => {
    const flat = {
      dateBucket: row.dateBucket,
      ...row.dimensions,
      ...Object.fromEntries(Object.entries(row.metrics || {}).map(([key, value]) => [`metrics.${key}`, value])),
      ...row.calculated,
      recordCount: row.recordCount,
    };
    return Object.fromEntries(mappings.map((mapping) => [mapping.destinationField, flat[mapping.sourceField] ?? null]));
  });
}

export async function previewDataHubDestinationTask(taskId, { businessId, actor = null, now = new Date() } = {}) {
  const task = await destinationTaskForBusiness(taskId, businessId);
  const result = await queryDataHubSavedView(task.view, { businessId, now });
  const rows = previewRows(result, task);
  const checksum = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  const run = await DataHubDestinationRun.create({
    business: businessId,
    task: task._id,
    view: task.view,
    mode: "preview",
    status: "previewed",
    executionAuthorised: false,
    rowCount: rows.length,
    checksum,
    evidence: {
      destinationType: task.type,
      deterministic: true,
      sourceCount: result.evidence.sources.length,
      recordsMatched: result.evidence.recordsMatched,
      generatedAt: now,
    },
    requestedBy: actorId(actor),
  });
  task.lastPreviewAt = now;
  task.updatedBy = actorId(actor) || task.updatedBy;
  await task.save();
  return {
    run,
    task: {
      id: task._id,
      key: task.key,
      name: task.name,
      type: task.type,
      format: task.format,
      writeMode: task.writeMode,
      executionAuthorised: false,
    },
    columns: result.columns,
    rows,
    rowCount: rows.length,
    checksum,
    evidence: result.evidence,
    message: "Destination preview generated. No external write was attempted or authorised.",
  };
}

export async function listDataHubDestinationRuns(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.taskId) match.task = objectId(query.taskId, "taskId");
  const limit = Math.min(250, Math.max(1, Number.parseInt(query.limit, 10) || 100));
  return DataHubDestinationRun.find(match)
    .populate("task", "key name type status")
    .populate("view", "key name status")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export async function buildDataHubAiEvidence(payload = {}, { businessId, now = new Date() } = {}) {
  const result = payload.viewId
    ? await queryDataHubSavedView(payload.viewId, { businessId, now })
    : await queryDataHub(payload.query || payload, { businessId, now });
  return {
    contract: "aiibp.data-hub.evidence",
    contractVersion: DATA_HUB_CONTRACT_VERSION,
    generatedAt: now,
    facts: {
      columns: result.columns,
      rows: result.rows,
      totals: result.totals,
    },
    provenance: result.evidence,
    interpretationPolicy: {
      canonicalFactsRequired: true,
      evidenceMustBeCited: true,
      deterministicBaseline: true,
      modelMayRecalculateCanonicalMetrics: false,
      externalWriteActionsAuthorised: false,
      humanApprovalRequiredForConsequentialAction: true,
    },
  };
}

export default {
  buildDataHubAiEvidence,
  createDataHubDestinationTask,
  createDataHubSavedView,
  dataHubCatalogue,
  dataHubFieldCatalogue,
  dataHubOverview,
  listDataHubDestinationRuns,
  listDataHubDestinationTasks,
  listDataHubSavedViews,
  normaliseDataHubQuery,
  previewDataHubDestinationTask,
  queryDataHub,
  queryDataHubSavedView,
  updateDataHubDestinationTask,
  updateDataHubSavedView,
};
