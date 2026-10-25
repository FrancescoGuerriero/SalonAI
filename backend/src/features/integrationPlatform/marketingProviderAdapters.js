import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GA4_ENDPOINT = "https://analyticsdata.googleapis.com/v1beta";
const SEARCH_CONSOLE_ENDPOINT = "https://www.googleapis.com/webmasters/v3";
const BING_API_ENDPOINT = "https://www.bing.com/webmaster/api.svc/json";
const BING_TOKEN_ENDPOINT = "https://www.bing.com/webmasters/oauth/token";
const GOOGLE_ADS_ENDPOINT = "https://googleads.googleapis.com/v26";
const META_MARKETING_ENDPOINT = "https://graph.facebook.com/v26.0";

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const MAX_PROVIDER_RECORDS = 100000;

function text(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function positiveInteger(value, fallback, min = 1, max = MAX_PROVIDER_RECORDS) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, Math.floor(number)))
    : fallback;
}

function dateOnly(value, fallback) {
  const date = value ? new Date(value) : fallback;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw createServiceError("Marketing provider date window is invalid.", 400);
  }
  return date.toISOString().slice(0, 10);
}

function defaultWindow(source, payload = {}) {
  const today = new Date();
  const fallbackStart = new Date(today.getTime() - 28 * 86400000);
  const checkpoint = source.checkpoint?.watermark || null;
  return {
    startDate: dateOnly(payload.start || checkpoint, fallbackStart),
    endDate: dateOnly(payload.end, today),
  };
}

function retryAfterMs(response, attempt) {
  const raw = response?.headers?.get?.("retry-after") || "";
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(60000, seconds * 1000);
  }
  return Math.min(30000, 1000 * (2 ** attempt));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options = {}, { retries = MAX_RETRIES } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const raw = await response.text();
      let body = {};
      if (raw) {
        try { body = JSON.parse(raw); }
        catch { body = { raw: text(raw, 2000) }; }
      }
      if (response.ok) return { response, body };

      const retryable = response.status === 429 || response.status >= 500;
      const error = createServiceError(
        `Marketing provider request failed with HTTP ${response.status}.`,
        response.status,
        {
          code: "MARKETING_PROVIDER_HTTP_ERROR",
          providerStatus: response.status,
          providerBody: body,
        }
      );
      if (!retryable || attempt >= retries) throw error;
      lastError = error;
      await delay(retryAfterMs(response, attempt));
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = createServiceError("Marketing provider request timed out.", 504, {
          code: "MARKETING_PROVIDER_TIMEOUT",
        });
      } else {
        lastError = error;
      }
      if (attempt >= retries || (lastError?.statusCode && lastError.statusCode < 500 && lastError.statusCode !== 429)) {
        throw lastError;
      }
      await delay(Math.min(30000, 1000 * (2 ** attempt)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || createServiceError("Marketing provider request failed.", 502);
}

async function connectionForSource(source) {
  if (!source.connection) {
    throw createServiceError("Live provider retrieval requires an IntegrationConnection.", 409, {
      code: "MARKETING_PROVIDER_CONNECTION_REQUIRED",
    });
  }
  const connection = await IntegrationConnection.findOne({
    _id: source.connection,
    business: source.business,
    app: source.app,
  });
  if (!connection || !["connected", "degraded"].includes(connection.status)) {
    throw createServiceError("Marketing provider connection is not connected.", 409, {
      code: "MARKETING_PROVIDER_CONNECTION_NOT_READY",
    });
  }
  return connection;
}

async function refreshOAuthToken(connection, provider) {
  const clientId = text(connection.metadata?.oauthClientId || connection.metadata?.clientId, 500);
  if (!clientId) {
    throw createServiceError("OAuth client ID is missing from connection metadata.", 409, {
      code: "OAUTH_CLIENT_ID_REQUIRED",
    });
  }
  const [refresh, clientSecret] = await Promise.all([
    resolveProviderCredential(connection, "refresh_token"),
    resolveProviderCredential(connection, "client_secret"),
  ]);
  const endpoint = provider === "bing_webmaster" ? BING_TOKEN_ENDPOINT : GOOGLE_TOKEN_ENDPOINT;
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret.secret,
    refresh_token: refresh.secret,
    grant_type: "refresh_token",
  });
  const { body } = await requestJson(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, { retries: 1 });
  const accessToken = text(body.access_token, 20000);
  if (!accessToken) {
    throw createServiceError("OAuth refresh did not return an access token.", 502, {
      code: "OAUTH_REFRESH_ACCESS_TOKEN_MISSING",
    });
  }
  const expiresIn = positiveInteger(body.expires_in, 3600, 60, 86400);
  const expiresAt = new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000);
  await storeProviderCredential(
    connection.app,
    connection._id,
    {
      role: "access_token",
      secret: accessToken,
      expiresAt,
      metadata: { refreshedBy: provider },
    },
    { businessId: connection.business }
  );
  return accessToken;
}

async function bearerForConnection(connection, provider) {
  try {
    const value = await resolveProviderCredential(connection, "access_token");
    return value.secret;
  } catch (error) {
    if (error?.code !== "PROVIDER_CREDENTIAL_EXPIRED" && error?.code !== "PROVIDER_CREDENTIAL_UNAVAILABLE") {
      throw error;
    }
    return refreshOAuthToken(connection, provider);
  }
}

function gaValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

async function fetchGa4(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = await bearerForConnection(connection, "ga4");
  const propertyId = text(source.sourceConfig?.propertyId, 200);
  if (!propertyId) throw createServiceError("GA4 sourceConfig.propertyId is required.", 422);

  const { startDate, endDate } = defaultWindow(source, payload);
  const dimensions = Array.isArray(source.sourceConfig?.dimensions) && source.sourceConfig.dimensions.length
    ? source.sourceConfig.dimensions.map((name) => ({ name: text(name, 100) }))
    : [{ name: "date" }, { name: "eventName" }];
  const metrics = Array.isArray(source.sourceConfig?.metrics) && source.sourceConfig.metrics.length
    ? source.sourceConfig.metrics.map((name) => ({ name: text(name, 100) }))
    : [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }];
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const pageSize = Math.min(25000, maxRecords);
  const records = [];
  let offset = 0;
  let total = null;

  while (records.length < maxRecords && (total === null || offset < total)) {
    const { body } = await requestJson(`${GA4_ENDPOINT}/properties/${encodeURIComponent(propertyId)}:runReport`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions,
        metrics,
        offset: String(offset),
        limit: String(Math.min(pageSize, maxRecords - records.length)),
      }),
    });
    const dimensionHeaders = (body.dimensionHeaders || []).map((item) => item.name);
    const metricHeaders = (body.metricHeaders || []).map((item) => item.name);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    for (const row of rows) {
      const record = {};
      dimensionHeaders.forEach((name, index) => { record[name] = row.dimensionValues?.[index]?.value ?? ""; });
      metricHeaders.forEach((name, index) => { record[name] = gaValue(row.metricValues?.[index]?.value); });
      records.push(record);
      if (records.length >= maxRecords) break;
    }
    total = Number.isFinite(Number(body.rowCount)) ? Number(body.rowCount) : records.length;
    if (!rows.length) break;
    offset += rows.length;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { propertyId, startDate, endDate, rowCount: records.length },
  };
}

async function fetchSearchConsole(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = await bearerForConnection(connection, "google_search_console");
  const siteUrl = text(source.sourceConfig?.siteUrl, 2000);
  if (!siteUrl) throw createServiceError("Search Console sourceConfig.siteUrl is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const dimensions = Array.isArray(source.sourceConfig?.dimensions) && source.sourceConfig.dimensions.length
    ? source.sourceConfig.dimensions.map((value) => text(value, 100))
    : ["date", "query", "page"];
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const rowLimit = Math.min(25000, maxRecords);
  const records = [];
  let startRow = 0;

  while (records.length < maxRecords) {
    const { body } = await requestJson(
      `${SEARCH_CONSOLE_ENDPOINT}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit: Math.min(rowLimit, maxRecords - records.length),
          startRow,
        }),
      }
    );
    const rows = Array.isArray(body.rows) ? body.rows : [];
    for (const row of rows) {
      const record = {
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0),
      };
      dimensions.forEach((name, index) => { record[name] = row.keys?.[index] ?? ""; });
      records.push(record);
      if (records.length >= maxRecords) break;
    }
    if (rows.length < rowLimit) break;
    startRow += rows.length;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`), cursor: String(startRow) },
    providerMeta: { siteUrl, startDate, endDate, rowCount: records.length },
  };
}

function bingDate(value) {
  const match = String(value || "").match(/\/Date\((\d+)/);
  if (match) return new Date(Number(match[1])).toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

async function fetchBing(source) {
  const connection = await connectionForSource(source);
  const siteUrl = text(source.sourceConfig?.siteUrl, 2000);
  if (!siteUrl) throw createServiceError("Bing sourceConfig.siteUrl is required.", 422);

  let authorization = null;
  let apiKey = null;
  try {
    authorization = await bearerForConnection(connection, "bing_webmaster");
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_NOT_BOUND", "PROVIDER_CREDENTIAL_UNAVAILABLE"].includes(error?.code)) throw error;
    apiKey = (await resolveProviderCredential(connection, "api_key")).secret;
  }
  const url = new URL(`${BING_API_ENDPOINT}/GetQueryStats`);
  url.searchParams.set("siteUrl", siteUrl);
  if (apiKey) url.searchParams.set("apikey", apiKey);
  const { body } = await requestJson(url.toString(), {
    method: "GET",
    headers: authorization ? { authorization: `Bearer ${authorization}` } : {},
  });
  const rows = Array.isArray(body.d) ? body.d : Array.isArray(body) ? body : [];
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const records = rows.slice(0, maxRecords).map((row) => ({
    date: bingDate(row.Date),
    query: text(row.Query, 2000),
    clicks: Number(row.Clicks || 0),
    impressions: Number(row.Impressions || 0),
    averageClickPosition: Number(row.AvgClickPosition || 0),
    averagePosition: Number(row.AvgImpressionPosition || 0),
  }));
  return {
    records,
    checkpoint: { watermark: new Date() },
    providerMeta: { siteUrl, rowCount: records.length },
  };
}

function digits(value) {
  return text(value, 100).replace(/\D/g, "");
}

function googleAdsNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function normaliseGoogleAdsRow(row = {}) {
  return {
    date: text(row.segments?.date, 20),
    campaignId: text(row.campaign?.id, 200),
    campaignName: text(row.campaign?.name, 1000),
    impressions: googleAdsNumber(row.metrics?.impressions),
    clicks: googleAdsNumber(row.metrics?.clicks),
    spend: googleAdsNumber(row.metrics?.costMicros) / 1_000_000,
    conversions: googleAdsNumber(row.metrics?.conversions),
    revenue: googleAdsNumber(row.metrics?.conversionsValue),
  };
}

async function fetchGoogleAds(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = await bearerForConnection(connection, "google_ads");
  const developerToken = (await resolveProviderCredential(connection, "api_key")).secret;
  const customerId = digits(source.sourceConfig?.customerId);
  const loginCustomerId = digits(source.sourceConfig?.loginCustomerId);
  if (!customerId) throw createServiceError("Google Ads sourceConfig.customerId is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const query = [
    "SELECT segments.date, campaign.id, campaign.name,",
    "metrics.impressions, metrics.clicks, metrics.cost_micros,",
    "metrics.conversions, metrics.conversions_value",
    "FROM campaign",
    `WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
    "ORDER BY segments.date ASC",
  ].join(" ");
  const headers = {
    authorization: `Bearer ${token}`,
    "developer-token": developerToken,
    "content-type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  const { body } = await requestJson(`${GOOGLE_ADS_ENDPOINT}/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  const batches = Array.isArray(body) ? body : [body];
  const records = [];
  for (const batch of batches) {
    for (const row of Array.isArray(batch?.results) ? batch.results : []) {
      records.push(normaliseGoogleAdsRow(row));
      if (records.length >= maxRecords) break;
    }
    if (records.length >= maxRecords) break;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { customerId, loginCustomerId: loginCustomerId || null, startDate, endDate, rowCount: records.length, apiVersion: "v26" },
  };
}

function metaActionValue(values, keys) {
  const byType = new Map((Array.isArray(values) ? values : []).map((item) => [String(item?.action_type || ""), Number(item?.value || 0)]));
  for (const key of keys) {
    if (byType.has(key) && Number.isFinite(byType.get(key))) return byType.get(key);
  }
  return 0;
}

export function normaliseMetaAdsRow(row = {}) {
  const purchaseKeys = [
    "offsite_conversion.fb_pixel_purchase",
    "omni_purchase",
    "purchase",
    "onsite_web_purchase",
  ];
  return {
    date: text(row.date_start, 20),
    campaignId: text(row.campaign_id, 200),
    campaignName: text(row.campaign_name, 1000),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    spend: Number(row.spend || 0),
    conversions: metaActionValue(row.actions, purchaseKeys),
    revenue: metaActionValue(row.action_values, purchaseKeys),
  };
}

async function fetchMetaAds(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = (await resolveProviderCredential(connection, "access_token")).secret;
  const rawAccountId = text(source.sourceConfig?.adAccountId, 200);
  const accountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${digits(rawAccountId)}`;
  if (!digits(accountId)) throw createServiceError("Meta Ads sourceConfig.adAccountId is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const fields = [
    "date_start",
    "campaign_id",
    "campaign_name",
    "impressions",
    "clicks",
    "spend",
    "actions",
    "action_values",
  ].join(",");
  let nextUrl = new URL(`${META_MARKETING_ENDPOINT}/${accountId}/insights`);
  nextUrl.searchParams.set("level", "campaign");
  nextUrl.searchParams.set("time_range", JSON.stringify({ since: startDate, until: endDate }));
  nextUrl.searchParams.set("time_increment", "1");
  nextUrl.searchParams.set("fields", fields);
  nextUrl.searchParams.set("limit", "500");
  const records = [];
  let pageCount = 0;
  while (nextUrl && records.length < maxRecords && pageCount < 500) {
    const { body } = await requestJson(nextUrl.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    for (const row of Array.isArray(body.data) ? body.data : []) {
      records.push(normaliseMetaAdsRow(row));
      if (records.length >= maxRecords) break;
    }
    const next = text(body.paging?.next, 8000);
    nextUrl = next ? new URL(next) : null;
    pageCount += 1;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { adAccountId: accountId, startDate, endDate, rowCount: records.length, pages: pageCount, apiVersion: "v26.0" },
  };
}

export async function fetchMarketingProviderRecords(source, payload = {}) {
  switch (source.provider) {
    case "ga4": return fetchGa4(source, payload);
    case "google_search_console": return fetchSearchConsole(source, payload);
    case "bing_webmaster": return fetchBing(source, payload);
    case "google_ads": return fetchGoogleAds(source, payload);
    case "meta_ads": return fetchMetaAds(source, payload);
    default:
      throw createServiceError(`Live retrieval is not implemented for provider: ${source.provider}.`, 409, {
        code: "MARKETING_PROVIDER_EXECUTOR_NOT_AVAILABLE",
      });
  }
}

export const MARKETING_PROVIDER_ENDPOINTS = Object.freeze({
  googleToken: GOOGLE_TOKEN_ENDPOINT,
  ga4: GA4_ENDPOINT,
  searchConsole: SEARCH_CONSOLE_ENDPOINT,
  bingApi: BING_API_ENDPOINT,
  bingToken: BING_TOKEN_ENDPOINT,
  googleAds: GOOGLE_ADS_ENDPOINT,
  metaMarketing: META_MARKETING_ENDPOINT,
});

export default {
  MARKETING_PROVIDER_ENDPOINTS,
  fetchMarketingProviderRecords,
  normaliseGoogleAdsRow,
  normaliseMetaAdsRow,
};
