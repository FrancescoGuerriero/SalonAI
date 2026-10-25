import { inflateRawSync } from "node:zlib";

import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

export const LINKEDIN_MARKETING_VERSION = "202610";
export const LINKEDIN_AD_ANALYTICS_ENDPOINT = "https://api.linkedin.com/rest/adAnalytics";
export const MICROSOFT_ADS_TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
export const MICROSOFT_REPORT_SUBMIT_ENDPOINT = "https://reporting.api.bingads.microsoft.com/Reporting/v13/GenerateReport/Submit";
export const MICROSOFT_REPORT_POLL_ENDPOINT = "https://reporting.api.bingads.microsoft.com/Reporting/v13/GenerateReport/Poll";
export const TIKTOK_REPORT_ENDPOINT = "https://business-api.tiktok.com/open_api/v2.0/report/integrated/get/";

const LINKEDIN_ORIGIN = "https://api.linkedin.com";
const MICROSOFT_DOWNLOAD_MAX_BYTES = 25 * 1024 * 1024;
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

function dateParts(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return { year, month, day };
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

async function requestBuffer(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw createServiceError("Provider download URL must use HTTPS.", 502, { code: "MARKETING_PROVIDER_UNSAFE_DOWNLOAD_URL" });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS * 2);
  try {
    const response = await fetch(parsed, { ...options, signal: controller.signal });
    if (!response.ok) throw createServiceError(`Provider download failed with HTTP ${response.status}.`, response.status);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MICROSOFT_DOWNLOAD_MAX_BYTES) throw createServiceError("Provider report exceeds the download size limit.", 413);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MICROSOFT_DOWNLOAD_MAX_BYTES) throw createServiceError("Provider report exceeds the download size limit.", 413);
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

async function connectionForSource(source) {
  if (!source.connection) throw createServiceError("Live provider retrieval requires an IntegrationConnection.", 409);
  const connection = await IntegrationConnection.findOne({ _id: source.connection, business: source.business, app: source.app });
  if (!connection || !["connected", "degraded"].includes(connection.status)) {
    throw createServiceError("Marketing provider connection is not connected.", 409, { code: "MARKETING_PROVIDER_CONNECTION_NOT_READY" });
  }
  return connection;
}

function accountUrn(value) {
  const raw = text(value, 500);
  if (!raw) return "";
  return raw.startsWith("urn:li:sponsoredAccount:") ? raw : `urn:li:sponsoredAccount:${raw.replace(/\D/g, "")}`;
}

export function normaliseLinkedInAdsRow(row = {}) {
  const campaignUrn = text(row.pivotValues?.[0], 500);
  const start = row.dateRange?.start || {};
  const date = [start.year, start.month, start.day].every(Number.isFinite)
    ? `${String(start.year).padStart(4, "0")}-${String(start.month).padStart(2, "0")}-${String(start.day).padStart(2, "0")}`
    : "";
  return {
    date,
    campaignId: campaignUrn.split(":").pop() || campaignUrn,
    campaignName: "",
    impressions: finiteNumber(row.impressions),
    clicks: finiteNumber(row.clicks ?? row.landingPageClicks),
    spend: finiteNumber(row.costInLocalCurrency),
    conversions: finiteNumber(row.externalWebsiteConversions),
    revenue: finiteNumber(row.conversionValueInLocalCurrency),
  };
}

async function fetchLinkedInAds(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = (await resolveProviderCredential(connection, "access_token")).secret;
  const account = accountUrn(source.sourceConfig?.adAccountUrn);
  if (!account) throw createServiceError("LinkedIn Ads sourceConfig.adAccountUrn is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const start = dateParts(startDate);
  const end = dateParts(endDate);
  const url = new URL(LINKEDIN_AD_ANALYTICS_ENDPOINT);
  url.searchParams.set("q", "statistics");
  url.searchParams.set("pivots", "List(CAMPAIGN)");
  url.searchParams.set("timeGranularity", "DAILY");
  url.searchParams.set("dateRange", `(start:(year:${start.year},month:${start.month},day:${start.day}),end:(year:${end.year},month:${end.month},day:${end.day}))`);
  url.searchParams.set("accounts", `List(${account})`);
  url.searchParams.set("fields", "dateRange,pivotValues,impressions,clicks,landingPageClicks,costInLocalCurrency,externalWebsiteConversions,conversionValueInLocalCurrency");
  const records = [];
  let nextUrl = url;
  let pageCount = 0;
  while (nextUrl && records.length < maxRecords && pageCount < 100) {
    const { body } = await requestJson(nextUrl.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "Linkedin-Version": LINKEDIN_MARKETING_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    for (const row of Array.isArray(body.elements) ? body.elements : []) {
      records.push(normaliseLinkedInAdsRow(row));
      if (records.length >= maxRecords) break;
    }
    const link = (body.paging?.links || []).find((item) => item?.rel === "next")?.href;
    if (!link) nextUrl = null;
    else {
      const candidate = new URL(link, LINKEDIN_ORIGIN);
      if (candidate.protocol !== "https:" || candidate.origin !== LINKEDIN_ORIGIN || !candidate.pathname.startsWith("/rest/adAnalytics")) {
        throw createServiceError("LinkedIn pagination returned an unsafe URL.", 502, { code: "LINKEDIN_PAGINATION_ORIGIN_REJECTED" });
      }
      nextUrl = candidate;
    }
    pageCount += 1;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { account, startDate, endDate, rowCount: records.length, pages: pageCount, apiVersion: LINKEDIN_MARKETING_VERSION },
  };
}

async function microsoftAccessToken(connection) {
  try {
    return (await resolveProviderCredential(connection, "access_token")).secret;
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId || connection.metadata?.oauthClientId, 500);
  if (!clientId) throw createServiceError("Microsoft Advertising OAuth client ID is required.", 409);
  const refresh = await resolveProviderCredential(connection, "refresh_token");
  let clientSecret = "";
  try { clientSecret = (await resolveProviderCredential(connection, "client_secret")).secret; } catch (error) {
    if (!["PROVIDER_CREDENTIAL_NOT_BOUND", "PROVIDER_CREDENTIAL_UNAVAILABLE"].includes(error?.code)) throw error;
  }
  const form = new URLSearchParams({
    client_id: clientId,
    scope: "https://ads.microsoft.com/msads.manage offline_access",
    refresh_token: refresh.secret,
    grant_type: "refresh_token",
  });
  if (clientSecret) form.set("client_secret", clientSecret);
  const { body } = await requestJson(MICROSOFT_ADS_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, 1);
  const accessToken = text(body.access_token, 20000);
  if (!accessToken) throw createServiceError("Microsoft Advertising OAuth refresh did not return an access token.", 502);
  const expiresAt = new Date(Date.now() + Math.max(60, finiteNumber(body.expires_in) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt,
    metadata: { refreshedBy: "microsoft_ads" },
  }, { businessId: connection.business });
  const rotatedRefresh = text(body.refresh_token, 20000);
  if (rotatedRefresh && rotatedRefresh !== refresh.secret) {
    await storeProviderCredential(connection.app, connection._id, {
      role: "refresh_token",
      secret: rotatedRefresh,
      metadata: { refreshedBy: "microsoft_ads" },
    }, { businessId: connection.business });
  }
  return accessToken;
}

function microsoftHeaders(token, developerToken, accountId, customerId) {
  return {
    authorization: `Bearer ${token}`,
    developertoken: developerToken,
    customeraccountid: String(accountId),
    customerid: String(customerId),
    "content-type": "application/json",
  };
}

function microsoftReportRequest(accountId, startDate, endDate) {
  const start = dateParts(startDate);
  const end = dateParts(endDate);
  return {
    ReportRequest: {
      Type: "CampaignPerformanceReportRequest",
      ExcludeColumnHeaders: false,
      ExcludeReportFooter: true,
      ExcludeReportHeader: true,
      Format: "Csv",
      FormatVersion: "2.0",
      ReportName: "AIIBP Campaign Performance",
      ReturnOnlyCompleteData: false,
      Aggregation: "Daily",
      Columns: ["TimePeriod", "CampaignId", "CampaignName", "CurrencyCode", "Impressions", "Clicks", "Spend", "Conversions", "Revenue"],
      Scope: { AccountIds: [String(accountId)] },
      Time: {
        CustomDateRangeStart: { Day: start.day, Month: start.month, Year: start.year },
        CustomDateRangeEnd: { Day: end.day, Month: end.month, Year: end.year },
      },
    },
  };
}

function unzipFirstEntry(buffer) {
  if (buffer.readUInt32LE(0) !== 0x04034b50) throw createServiceError("Microsoft Advertising report is not a supported ZIP file.", 502);
  const method = buffer.readUInt16LE(8);
  const compressedSize = buffer.readUInt32LE(18);
  const fileNameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);
  const dataStart = 30 + fileNameLength + extraLength;
  if (!compressedSize || dataStart + compressedSize > buffer.length) throw createServiceError("Microsoft Advertising ZIP structure is unsupported.", 502);
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return compressed;
  if (method === 8) return inflateRawSync(compressed);
  throw createServiceError("Microsoft Advertising ZIP compression method is unsupported.", 502);
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

function parseCsv(content) {
  const lines = String(content).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function normaliseMicrosoftAdsRow(row = {}) {
  return {
    date: text(row.TimePeriod, 20),
    campaignId: text(row.CampaignId, 200),
    campaignName: text(row.CampaignName, 1000),
    impressions: finiteNumber(String(row.Impressions ?? "").replace(/,/g, "")),
    clicks: finiteNumber(String(row.Clicks ?? "").replace(/,/g, "")),
    spend: finiteNumber(String(row.Spend ?? "").replace(/[^0-9.-]/g, "")),
    conversions: finiteNumber(String(row.Conversions ?? "").replace(/,/g, "")),
    revenue: finiteNumber(String(row.Revenue ?? "").replace(/[^0-9.-]/g, "")),
  };
}

async function fetchMicrosoftAds(source, payload = {}) {
  const connection = await connectionForSource(source);
  const accountId = text(source.sourceConfig?.accountId, 100);
  const customerId = text(source.sourceConfig?.customerId, 100);
  if (!accountId || !customerId) throw createServiceError("Microsoft Advertising accountId and customerId are required.", 422);
  const token = await microsoftAccessToken(connection);
  const developerToken = (await resolveProviderCredential(connection, "api_key")).secret;
  const headers = microsoftHeaders(token, developerToken, accountId, customerId);
  const { startDate, endDate } = defaultWindow(source, payload);
  const { body: submit } = await requestJson(MICROSOFT_REPORT_SUBMIT_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(microsoftReportRequest(accountId, startDate, endDate)),
  });
  const reportRequestId = text(submit.ReportRequestId, 200);
  if (!reportRequestId) throw createServiceError("Microsoft Advertising did not return a report request ID.", 502);
  let downloadUrl = "";
  let status = "Pending";
  const maxPolls = positiveInteger(source.sourceConfig?.maxPolls, 10, 1, 20);
  for (let poll = 0; poll < maxPolls; poll += 1) {
    if (poll > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(5000, 1000 * poll)));
    const { body } = await requestJson(MICROSOFT_REPORT_POLL_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ ReportRequestId: reportRequestId }),
    });
    status = text(body.ReportRequestStatus?.Status, 100);
    if (status === "Success") {
      downloadUrl = text(body.ReportRequestStatus?.ReportDownloadUrl, 8000);
      break;
    }
    if (status === "Error") throw createServiceError("Microsoft Advertising report generation failed.", 502);
  }
  if (!downloadUrl) throw createServiceError("Microsoft Advertising report was not ready within the bounded polling window.", 504, { code: "MICROSOFT_REPORT_NOT_READY" });
  const zipped = await requestBuffer(downloadUrl);
  const csv = unzipFirstEntry(zipped).toString("utf8");
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const records = parseCsv(csv).slice(0, maxRecords).map(normaliseMicrosoftAdsRow);
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { accountId, customerId, startDate, endDate, rowCount: records.length, reportApiVersion: "v13" },
  };
}

export function normaliseTikTokAdsRow(row = {}) {
  const dimensions = row.dimensions || {};
  const metrics = row.metrics || {};
  return {
    date: text(dimensions.stat_time_day || metrics.stat_time_day, 20).slice(0, 10),
    campaignId: text(dimensions.campaign_id || metrics.campaign_id, 200),
    campaignName: text(metrics.campaign_name, 1000),
    impressions: finiteNumber(metrics.impressions),
    clicks: finiteNumber(metrics.clicks),
    spend: finiteNumber(metrics.spend),
    conversions: finiteNumber(metrics.conversion ?? metrics.conversions),
    revenue: finiteNumber(metrics.total_purchase_value ?? metrics.purchase_value ?? metrics.value),
  };
}

async function fetchTikTokAds(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = (await resolveProviderCredential(connection, "access_token")).secret;
  const advertiserId = text(source.sourceConfig?.advertiserId, 100);
  if (!advertiserId) throw createServiceError("TikTok Ads sourceConfig.advertiserId is required.", 422);
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const pageSize = Math.min(1000, maxRecords);
  const records = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 100 && records.length < maxRecords) {
    const url = new URL(TIKTOK_REPORT_ENDPOINT);
    url.searchParams.set("advertiser_id", advertiserId);
    url.searchParams.set("report_type", "BASIC");
    url.searchParams.set("data_level", "AUCTION_CAMPAIGN");
    url.searchParams.set("dimensions", JSON.stringify(["campaign_id", "stat_time_day"]));
    url.searchParams.set("metrics", JSON.stringify(["campaign_name", "spend", "impressions", "clicks", "conversion", "total_purchase_value"]));
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    const { body } = await requestJson(url.toString(), {
      method: "GET",
      headers: { "Access-Token": token },
    });
    if (finiteNumber(body.code) !== 0) throw createServiceError(`TikTok reporting returned code ${body.code}: ${text(body.message, 1000)}`, 502, { code: "TIKTOK_REPORT_ERROR" });
    const list = Array.isArray(body.data?.list) ? body.data.list : [];
    for (const row of list) {
      records.push(normaliseTikTokAdsRow(row));
      if (records.length >= maxRecords) break;
    }
    totalPages = positiveInteger(body.data?.page_info?.total_page, page, 1, 100);
    if (!list.length) break;
    page += 1;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`) },
    providerMeta: { advertiserId, startDate, endDate, rowCount: records.length, pages: Math.max(0, page - 1), apiVersion: "v2.0" },
  };
}

export async function fetchMarketingAdvertisingProviderRecords(source, payload = {}) {
  switch (source.provider) {
    case "linkedin_ads": return fetchLinkedInAds(source, payload);
    case "microsoft_ads": return fetchMicrosoftAds(source, payload);
    case "tiktok_ads": return fetchTikTokAds(source, payload);
    default:
      throw createServiceError(`Advertising provider executor is not available: ${source.provider}.`, 409, { code: "MARKETING_PROVIDER_EXECUTOR_NOT_AVAILABLE" });
  }
}

export default {
  fetchMarketingAdvertisingProviderRecords,
  normaliseLinkedInAdsRow,
  normaliseMicrosoftAdsRow,
  normaliseTikTokAdsRow,
};
