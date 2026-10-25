import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

export const GOOGLE_BUSINESS_PERFORMANCE_ORIGIN = "https://businessprofileperformance.googleapis.com";
export const HUBSPOT_MARKETING_EMAIL_ENDPOINT = "https://api.hubapi.com/marketing/v3/emails";
export const MAILCHIMP_API_SUFFIX = ".api.mailchimp.com";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PROVIDER_RECORDS = 100000;

function text(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function finiteNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function positiveInteger(value, fallback, min = 1, max = MAX_PROVIDER_RECORDS) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
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
  return {
    startDate: dateOnly(payload.start || source.checkpoint?.watermark, fallbackStart),
    endDate: dateOnly(payload.end, today),
  };
}

async function requestJson(url, options = {}, retries = 2) {
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
        catch { body = { raw: text(raw, 3000) }; }
      }
      if (response.ok) return { response, body };
      const retryable = response.status === 429 || response.status >= 500;
      const error = createServiceError(`Marketing provider request failed with HTTP ${response.status}.`, response.status, {
        code: "MARKETING_PROVIDER_HTTP_ERROR",
        providerStatus: response.status,
        providerBody: body,
      });
      if (!retryable || attempt >= retries) throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(10000, 1000 * (2 ** attempt))));
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? createServiceError("Marketing provider request timed out.", 504, { code: "MARKETING_PROVIDER_TIMEOUT" })
        : error;
      if (attempt >= retries || (lastError?.statusCode && lastError.statusCode < 500 && lastError.statusCode !== 429)) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, Math.min(10000, 1000 * (2 ** attempt))));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || createServiceError("Marketing provider request failed.", 502);
}

async function connectionForSource(source) {
  if (!source.connection) throw createServiceError("Live provider retrieval requires an IntegrationConnection.", 409);
  const connection = await IntegrationConnection.findOne({ _id: source.connection, business: source.business, app: source.app });
  if (!connection || !["connected", "degraded"].includes(connection.status)) {
    throw createServiceError("Marketing provider connection is not connected.", 409, { code: "MARKETING_PROVIDER_CONNECTION_NOT_READY" });
  }
  return connection;
}

async function googleBearer(connection, provider) {
  try {
    return (await resolveProviderCredential(connection, "access_token")).secret;
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId || connection.metadata?.oauthClientId, 500);
  if (!clientId) throw createServiceError("Google OAuth client ID is required.", 409);
  const [refresh, clientSecret] = await Promise.all([
    resolveProviderCredential(connection, "refresh_token"),
    resolveProviderCredential(connection, "client_secret"),
  ]);
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret.secret,
    refresh_token: refresh.secret,
    grant_type: "refresh_token",
  });
  const { body } = await requestJson(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, 1);
  const accessToken = text(body.access_token, 20000);
  if (!accessToken) throw createServiceError("Google OAuth refresh did not return an access token.", 502);
  const expiresIn = positiveInteger(body.expires_in, 3600, 60, 86400);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt: new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000),
    metadata: { refreshedBy: provider },
  }, { businessId: connection.business });
  return accessToken;
}

function dateParts(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return { year, month, day };
}

function normaliseLocationId(value) {
  const raw = text(value, 500);
  if (!raw) return "";
  return raw.startsWith("locations/") ? raw : `locations/${raw.replace(/\D/g, "")}`;
}

function dailyMetricKey(metric) {
  return ({
    BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "views",
    BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "views",
    BUSINESS_IMPRESSIONS_MOBILE_MAPS: "views",
    BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "views",
    WEBSITE_CLICKS: "websiteClicks",
    CALL_CLICKS: "calls",
    BUSINESS_DIRECTION_REQUESTS: "directionRequests",
  })[metric] || "";
}

export function normaliseGoogleBusinessPerformance(series = [], locationId = "") {
  const byDate = new Map();
  const add = (date, field, value) => {
    const current = byDate.get(date) || {
      date,
      locationId,
      locationName: "",
      views: 0,
      websiteClicks: 0,
      calls: 0,
      directionRequests: 0,
    };
    if (field === "views") current.views += finiteNumber(value);
    else current[field] = finiteNumber(value);
    byDate.set(date, current);
  };
  for (const outer of Array.isArray(series) ? series : []) {
    for (const metricSeries of Array.isArray(outer?.dailyMetricTimeSeries) ? outer.dailyMetricTimeSeries : []) {
      const field = dailyMetricKey(metricSeries?.dailyMetric);
      if (!field) continue;
      for (const point of Array.isArray(metricSeries?.timeSeries?.datedValues) ? metricSeries.timeSeries.datedValues : []) {
        const date = point?.date || {};
        const day = [date.year, date.month, date.day].every(Number.isFinite)
          ? `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`
          : "";
        if (day) add(day, field, point.value);
      }
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchGoogleBusinessProfile(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = await googleBearer(connection, "google_business_profile");
  const locationId = normaliseLocationId(source.sourceConfig?.locationId);
  if (!locationId || locationId === "locations/") throw createServiceError("Google Business Profile sourceConfig.locationId is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const start = dateParts(startDate);
  const end = dateParts(endDate);
  const url = new URL(`${GOOGLE_BUSINESS_PERFORMANCE_ORIGIN}/v1/${locationId}:fetchMultiDailyMetricsTimeSeries`);
  for (const metric of [
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "WEBSITE_CLICKS",
    "CALL_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
  ]) url.searchParams.append("dailyMetrics", metric);
  for (const [name, value] of Object.entries({
    "daily_range.start_date.year": start.year,
    "daily_range.start_date.month": start.month,
    "daily_range.start_date.day": start.day,
    "daily_range.end_date.year": end.year,
    "daily_range.end_date.month": end.month,
    "daily_range.end_date.day": end.day,
  })) url.searchParams.set(name, String(value));
  const { body } = await requestJson(url.toString(), { method: "GET", headers: { authorization: `Bearer ${token}` } });
  const records = normaliseGoogleBusinessPerformance(body.multiDailyMetricTimeSeries, locationId);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  return {
    records: records.slice(0, maxRecords),
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { locationId, startDate, endDate, rowCount: Math.min(records.length, maxRecords), apiVersion: "v1" },
  };
}

function statCounter(counters = {}, names = []) {
  for (const name of names) {
    const value = counters?.[name];
    if (value !== undefined) {
      if (typeof value === "number" || typeof value === "string") return finiteNumber(value);
      if (value && typeof value === "object") {
        for (const child of ["count", "value", "total", "unique"]) {
          if (value[child] !== undefined) return finiteNumber(value[child]);
        }
      }
    }
  }
  return 0;
}

export function normaliseHubSpotEmail(email = {}) {
  const counters = email.stats?.counters || {};
  const date = text(email.publishedAt || email.publishDate || email.createdAt, 100);
  return {
    date: date ? date.slice(0, 10) : "",
    campaignId: text(email.campaign || email.primaryEmailCampaignId || email.id, 300),
    campaignName: text(email.campaignName || email.name || email.subject, 1000),
    sends: statCounter(counters, ["sent", "SENT", "delivered", "DELIVERED", "processed"]),
    opens: statCounter(counters, ["open", "opens", "OPEN", "uniqueOpen", "unique_opens"]),
    clicks: statCounter(counters, ["click", "clicks", "CLICK", "uniqueClick", "unique_clicks"]),
    conversions: statCounter(counters, ["conversion", "conversions", "CONVERSION"]),
  };
}

function safeHubSpotNext(after) {
  const value = text(after, 1000);
  return value && /^[A-Za-z0-9._~:+\-/=]+$/.test(value) ? value : "";
}

async function fetchHubSpot(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = (await resolveProviderCredential(connection, "access_token")).secret;
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const records = [];
  let after = "";
  let pages = 0;
  while (records.length < maxRecords && pages < 100) {
    const url = new URL(HUBSPOT_MARKETING_EMAIL_ENDPOINT);
    url.searchParams.set("limit", String(Math.min(100, maxRecords - records.length)));
    url.searchParams.set("includeStats", "true");
    if (after) url.searchParams.set("after", after);
    const { body } = await requestJson(url.toString(), { method: "GET", headers: { authorization: `Bearer ${token}` } });
    const items = Array.isArray(body.results) ? body.results : [];
    for (const email of items) {
      const record = normaliseHubSpotEmail(email);
      if (!record.date || (record.date >= startDate && record.date <= endDate)) records.push(record);
      if (records.length >= maxRecords) break;
    }
    after = safeHubSpotNext(body.paging?.next?.after);
    pages += 1;
    if (!items.length || !after) break;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`), cursor: after || "" },
    providerMeta: { startDate, endDate, rowCount: records.length, pages, apiVersion: "v3" },
  };
}

function mailchimpOrigin(serverPrefix) {
  const prefix = text(serverPrefix, 30).toLowerCase();
  if (!/^[a-z]{2}\d{1,4}$/.test(prefix)) {
    throw createServiceError("Mailchimp serverPrefix must look like us21.", 422, { code: "MAILCHIMP_SERVER_PREFIX_INVALID" });
  }
  return `https://${prefix}${MAILCHIMP_API_SUFFIX}`;
}

export function normaliseMailchimpReport(report = {}) {
  const date = text(report.send_time, 100);
  return {
    date: date ? date.slice(0, 10) : "",
    campaignId: text(report.id, 300),
    campaignName: text(report.campaign_title || report.subject_line, 1000),
    sends: finiteNumber(report.emails_sent),
    opens: finiteNumber(report.opens?.unique_opens ?? report.opens?.opens_total),
    clicks: finiteNumber(report.clicks?.unique_clicks ?? report.clicks?.clicks_total),
    conversions: finiteNumber(report.ecommerce?.total_orders),
  };
}

async function fetchMailchimp(source, payload = {}) {
  const connection = await connectionForSource(source);
  const apiKey = (await resolveProviderCredential(connection, "api_key")).secret;
  const origin = mailchimpOrigin(source.sourceConfig?.serverPrefix);
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const records = [];
  let offset = 0;
  const pageSize = Math.min(1000, maxRecords);
  let pages = 0;
  while (records.length < maxRecords && pages < 100) {
    const url = new URL(`${origin}/3.0/reports`);
    url.searchParams.set("count", String(Math.min(pageSize, maxRecords - records.length)));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("since_send_time", `${startDate}T00:00:00+00:00`);
    url.searchParams.set("before_send_time", `${endDate}T23:59:59+00:00`);
    const { body } = await requestJson(url.toString(), { method: "GET", headers: { authorization: `Bearer ${apiKey}` } });
    const items = Array.isArray(body.reports) ? body.reports : [];
    for (const report of items) records.push(normaliseMailchimpReport(report));
    offset += items.length;
    pages += 1;
    const total = positiveInteger(body.total_items, offset, 0, MAX_PROVIDER_RECORDS);
    if (!items.length || offset >= total) break;
  }
  return {
    records: records.slice(0, maxRecords),
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`), cursor: String(offset) },
    providerMeta: { serverPrefix: text(source.sourceConfig?.serverPrefix, 30), startDate, endDate, rowCount: Math.min(records.length, maxRecords), pages },
  };
}

export async function fetchMarketingFinalProviderRecords(source, payload = {}) {
  switch (source.provider) {
    case "google_business_profile": return fetchGoogleBusinessProfile(source, payload);
    case "hubspot": return fetchHubSpot(source, payload);
    case "mailchimp": return fetchMailchimp(source, payload);
    default:
      throw createServiceError(`Final marketing provider executor is not available: ${source.provider}.`, 409, { code: "MARKETING_PROVIDER_EXECUTOR_NOT_AVAILABLE" });
  }
}

export default {
  fetchMarketingFinalProviderRecords,
  normaliseGoogleBusinessPerformance,
  normaliseHubSpotEmail,
  normaliseMailchimpReport,
};
