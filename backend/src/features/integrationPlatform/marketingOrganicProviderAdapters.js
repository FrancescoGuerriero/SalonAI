import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

export const META_GRAPH_VERSION = "v26.0";
export const META_GRAPH_ORIGIN = "https://graph.facebook.com";
export const LINKEDIN_MARKETING_VERSION = "202610";
export const LINKEDIN_PAGE_STATISTICS_ENDPOINT = "https://api.linkedin.com/rest/organizationPageStatistics";
export const YOUTUBE_ANALYTICS_ENDPOINT = "https://youtubeanalytics.googleapis.com/v2/reports";
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

function safeMetaNext(value, expectedPathPrefix) {
  const raw = text(value, 8000);
  if (!raw) return null;
  const candidate = new URL(raw, META_GRAPH_ORIGIN);
  if (candidate.protocol !== "https:" || candidate.origin !== META_GRAPH_ORIGIN || !candidate.pathname.startsWith(expectedPathPrefix)) {
    throw createServiceError("Meta pagination returned an unsafe URL.", 502, { code: "META_PAGINATION_ORIGIN_REJECTED" });
  }
  return candidate;
}

function metricDate(value, fallback) {
  const parsed = new Date(value || fallback);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
}

export function normaliseFacebookPageInsights(data = [], pageId = "", fallbackDate = "") {
  const byDate = new Map();
  const assign = (date, field, value) => {
    const current = byDate.get(date) || {
      date,
      contentId: pageId,
      contentType: "facebook_page",
      impressions: 0,
      reach: 0,
      engagements: 0,
      clicks: 0,
    };
    current[field] = finiteNumber(value);
    byDate.set(date, current);
  };
  const mapping = {
    page_media_view: "impressions",
    page_post_engagements: "engagements",
    page_views_total: "clicks",
  };
  for (const metric of Array.isArray(data) ? data : []) {
    const field = mapping[metric?.name];
    if (!field) continue;
    for (const item of Array.isArray(metric.values) ? metric.values : []) {
      assign(metricDate(item.end_time, fallbackDate), field, item.value);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchFacebookPages(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = (await resolveProviderCredential(connection, "access_token")).secret;
  const pageId = text(source.sourceConfig?.pageId, 200);
  if (!pageId) throw createServiceError("Facebook Pages sourceConfig.pageId is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const since = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const until = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
  let nextUrl = new URL(`${META_GRAPH_ORIGIN}/${META_GRAPH_VERSION}/${encodeURIComponent(pageId)}/insights`);
  nextUrl.searchParams.set("metric", "page_media_view,page_post_engagements,page_views_total");
  nextUrl.searchParams.set("period", "day");
  nextUrl.searchParams.set("since", String(since));
  nextUrl.searchParams.set("until", String(until));
  const records = [];
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  let pages = 0;
  while (nextUrl && pages < 100 && records.length < maxRecords) {
    const { body } = await requestJson(nextUrl.toString(), { method: "GET", headers: { authorization: `Bearer ${token}` } });
    records.push(...normaliseFacebookPageInsights(body.data, pageId, endDate));
    nextUrl = safeMetaNext(body.paging?.next, `/${META_GRAPH_VERSION}/${encodeURIComponent(pageId)}/insights`);
    pages += 1;
  }
  return {
    records: records.slice(0, maxRecords),
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { pageId, startDate, endDate, rowCount: Math.min(records.length, maxRecords), pages, apiVersion: META_GRAPH_VERSION },
  };
}

export function normaliseInstagramInsights(data = [], accountId = "", fallbackDate = "") {
  const record = {
    date: fallbackDate,
    contentId: accountId,
    contentType: "instagram_account",
    impressions: 0,
    reach: 0,
    engagements: 0,
    clicks: 0,
  };
  for (const metric of Array.isArray(data) ? data : []) {
    const totalValue = finiteNumber(metric.total_value?.value ?? metric.values?.[0]?.value);
    if (metric.name === "views") record.impressions = totalValue;
    else if (metric.name === "reach") record.reach = totalValue;
    else if (metric.name === "total_interactions") record.engagements = totalValue;
  }
  return record;
}

async function fetchInstagramOrganic(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = (await resolveProviderCredential(connection, "access_token")).secret;
  const accountId = text(source.sourceConfig?.instagramProfessionalAccountId, 200);
  if (!accountId) throw createServiceError("Instagram sourceConfig.instagramProfessionalAccountId is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const url = new URL(`${META_GRAPH_ORIGIN}/${META_GRAPH_VERSION}/${encodeURIComponent(accountId)}/insights`);
  url.searchParams.set("metric", "views,reach,total_interactions");
  url.searchParams.set("period", "day");
  url.searchParams.set("metric_type", "total_value");
  url.searchParams.set("since", String(Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000)));
  url.searchParams.set("until", String(Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000)));
  const { body } = await requestJson(url.toString(), { method: "GET", headers: { authorization: `Bearer ${token}` } });
  return {
    records: [normaliseInstagramInsights(body.data, accountId, endDate)],
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { accountId, startDate, endDate, rowCount: 1, apiVersion: META_GRAPH_VERSION },
  };
}

function organizationUrn(value) {
  const raw = text(value, 500);
  if (!raw) return "";
  if (raw.startsWith("urn:li:organization:")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `urn:li:organization:${digits}` : "";
}

function nestedTotal(value) {
  if (typeof value === "number" || typeof value === "string") return finiteNumber(value);
  if (!value || typeof value !== "object") return 0;
  for (const key of ["allPageViews", "allPageClicks", "total", "count", "overallPageViews", "overviewPageViews"]) {
    if (value[key] !== undefined) return nestedTotal(value[key]);
  }
  return Object.values(value).reduce((sum, item) => sum + (typeof item === "object" ? nestedTotal(item) : 0), 0);
}

export function normaliseLinkedInPageRow(row = {}) {
  const start = finiteNumber(row.timeRange?.start);
  const stats = row.totalPageStatistics || {};
  return {
    date: start ? new Date(start).toISOString().slice(0, 10) : "",
    contentId: text(row.organization, 500),
    contentType: "linkedin_page",
    impressions: nestedTotal(stats.views),
    reach: 0,
    engagements: 0,
    clicks: nestedTotal(stats.clicks),
  };
}

async function fetchLinkedInPages(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = (await resolveProviderCredential(connection, "access_token")).secret;
  const organisation = organizationUrn(source.sourceConfig?.organisationUrn);
  if (!organisation) throw createServiceError("LinkedIn Pages sourceConfig.organisationUrn is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T23:59:59.999Z`).getTime();
  const url = new URL(LINKEDIN_PAGE_STATISTICS_ENDPOINT);
  url.searchParams.set("q", "organization");
  url.searchParams.set("organization", organisation);
  url.searchParams.set("timeIntervals", `(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`);
  const { body } = await requestJson(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "Linkedin-Version": LINKEDIN_MARKETING_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const records = (Array.isArray(body.elements) ? body.elements : []).slice(0, maxRecords).map(normaliseLinkedInPageRow);
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { organisation, startDate, endDate, rowCount: records.length, apiVersion: LINKEDIN_MARKETING_VERSION },
  };
}

export function normaliseYouTubeRow(headers = [], row = []) {
  const record = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  const likes = finiteNumber(record.likes);
  const comments = finiteNumber(record.comments);
  const shares = finiteNumber(record.shares);
  return {
    date: text(record.day, 20),
    contentId: "channel",
    contentType: "youtube_channel",
    impressions: finiteNumber(record.views),
    reach: finiteNumber(record.uniques),
    engagements: likes + comments + shares,
    clicks: 0,
  };
}

async function fetchYouTubeAnalytics(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = await googleBearer(connection, "youtube_analytics");
  const channelId = text(source.sourceConfig?.channelId, 300);
  if (!channelId) throw createServiceError("YouTube Analytics sourceConfig.channelId is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const records = [];
  let startIndex = 1;
  const pageSize = Math.min(200, maxRecords);
  while (records.length < maxRecords && startIndex <= 100000) {
    const url = new URL(YOUTUBE_ANALYTICS_ENDPOINT);
    url.searchParams.set("ids", `channel==${channelId}`);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("metrics", "views,likes,comments,shares,estimatedMinutesWatched,subscribersGained,subscribersLost");
    url.searchParams.set("dimensions", "day");
    url.searchParams.set("sort", "day");
    url.searchParams.set("maxResults", String(Math.min(pageSize, maxRecords - records.length)));
    url.searchParams.set("startIndex", String(startIndex));
    const { body } = await requestJson(url.toString(), { method: "GET", headers: { authorization: `Bearer ${token}` } });
    const headers = (body.columnHeaders || []).map((item) => item.name);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    for (const row of rows) records.push(normaliseYouTubeRow(headers, row));
    if (rows.length < pageSize) break;
    startIndex += rows.length;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { channelId, startDate, endDate, rowCount: records.length },
  };
}

export async function fetchMarketingOrganicProviderRecords(source, payload = {}) {
  switch (source.provider) {
    case "facebook_pages": return fetchFacebookPages(source, payload);
    case "instagram_organic": return fetchInstagramOrganic(source, payload);
    case "linkedin_pages": return fetchLinkedInPages(source, payload);
    case "youtube_analytics": return fetchYouTubeAnalytics(source, payload);
    default:
      throw createServiceError(`Organic provider executor is not available: ${source.provider}.`, 409, { code: "MARKETING_PROVIDER_EXECUTOR_NOT_AVAILABLE" });
  }
}

export default {
  fetchMarketingOrganicProviderRecords,
  normaliseFacebookPageInsights,
  normaliseInstagramInsights,
  normaliseLinkedInPageRow,
  normaliseYouTubeRow,
};
