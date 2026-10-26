import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "error" });
    const raw = await response.text();
    let body = {};
    if (raw) {
      try { body = JSON.parse(raw); }
      catch { body = { raw: text(raw, 1000) }; }
    }
    if (!response.ok) {
      throw createServiceError(`Provider account verification failed with HTTP ${response.status}.`, 409, {
        code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
        providerStatus: response.status,
      });
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createServiceError("Provider account verification timed out.", 504, {
        code: "MARKETING_PROVIDER_VERIFICATION_TIMEOUT",
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function credential(connection, role) {
  return (await resolveProviderCredential(connection, role)).secret;
}

async function googleAccessToken(connection, refreshedBy) {
  try {
    return await credential(connection, "access_token");
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId, 500);
  if (!clientId) throw createServiceError("Google OAuth client ID is required.", 400, { field: "clientId" });
  const clientSecret = await credential(connection, "client_secret");
  const refreshToken = await credential(connection, "refresh_token");
  const body = await requestJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const accessToken = text(body.access_token, 20000);
  if (!accessToken) throw createServiceError("Google OAuth did not return an access token.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt,
    metadata: { refreshedBy },
  }, { businessId: connection.business });
  return accessToken;
}

async function verifyGoogleAdManager(connection) {
  const token = await googleAccessToken(connection, "google_ad_manager_verification");
  const body = await requestJson("https://admanager.googleapis.com/v1/networks?pageSize=1", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const networks = Array.isArray(body.networks) ? body.networks : [];
  if (!networks.length) throw createServiceError("No Google Ad Manager network is accessible to these credentials.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const network = networks[0];
  return { accountId: network.networkCode || network.name, accountName: network.displayName || network.name, networkCount: networks.length };
}

async function verifyGoogleBigQuery(connection) {
  const token = await googleAccessToken(connection, "google_bigquery_verification");
  const projectId = text(connection.metadata?.projectId, 300);
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) {
    throw createServiceError("Google Cloud project ID is invalid.", 400, { field: "projectId" });
  }
  const body = await requestJson(`https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/datasets?maxResults=1`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  return { accountId: projectId, accountName: projectId, datasetCountAtLeast: Array.isArray(body.datasets) ? body.datasets.length : 0 };
}

async function verifyGoogleCampaignManager360(connection) {
  const token = await googleAccessToken(connection, "google_cm360_verification");
  const body = await requestJson("https://dfareporting.googleapis.com/dfareporting/v5/userprofiles", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const profiles = Array.isArray(body.items) ? body.items : [];
  if (!profiles.length) throw createServiceError("No Campaign Manager 360 user profile is accessible to these credentials.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const first = profiles[0];
  return { accountId: first.accountId || first.profileId, accountName: first.accountName || first.userName, profileId: first.profileId, profileCount: profiles.length };
}

async function verifyGoogleDv360(connection) {
  const token = await googleAccessToken(connection, "google_dv360_verification");
  const partnerId = text(connection.metadata?.partnerId, 100).replace(/\D/g, "");
  if (!partnerId) throw createServiceError("DV360 partner ID is required.", 400, { field: "partnerId" });
  const url = new URL("https://displayvideo.googleapis.com/v4/advertisers");
  url.searchParams.set("partnerId", partnerId);
  url.searchParams.set("pageSize", "1");
  const body = await requestJson(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  const advertisers = Array.isArray(body.advertisers) ? body.advertisers : [];
  return { accountId: partnerId, accountName: advertisers[0]?.displayName || `DV360 partner ${partnerId}`, advertiserId: advertisers[0]?.advertiserId || "", advertiserCountAtLeast: advertisers.length };
}

async function verifyGoogleMerchantCenter(connection) {
  const token = await googleAccessToken(connection, "google_merchant_center_verification");
  const body = await requestJson("https://merchantapi.googleapis.com/accounts/v1/accounts?pageSize=1", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const accounts = Array.isArray(body.accounts) ? body.accounts : [];
  if (!accounts.length) throw createServiceError("No Merchant Center account is accessible to these credentials.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const first = accounts[0];
  return { accountId: first.accountId || first.name, accountName: first.accountName || first.name, timeZone: first.timeZone?.id, accountCount: accounts.length };
}

async function verifyGoogleSa360(connection) {
  const token = await googleAccessToken(connection, "google_sa360_verification");
  const customerId = text(connection.metadata?.customerId, 100).replace(/\D/g, "");
  if (!customerId) throw createServiceError("SA360 customer ID is required.", 400, { field: "customerId" });
  const body = await requestJson(`https://searchads360.googleapis.com/v0/customers/${customerId}/searchAds360:search`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
      pageSize: 1,
    }),
  });
  const customer = body.results?.[0]?.customer || {};
  return { accountId: customer.id || customerId, accountName: customer.descriptiveName || `SA360 customer ${customerId}` };
}

async function verifyGoogleSheets(connection) {
  const token = await googleAccessToken(connection, "google_sheets_verification");
  const spreadsheetId = text(connection.metadata?.spreadsheetId, 500);
  if (!spreadsheetId) throw createServiceError("Google Sheets spreadsheet ID is required.", 400, { field: "spreadsheetId" });
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`);
  url.searchParams.set("fields", "spreadsheetId,properties.title");
  const body = await requestJson(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  return { accountId: body.spreadsheetId || spreadsheetId, accountName: body.properties?.title || `Spreadsheet ${spreadsheetId}` };
}

function publicHttpUrl(value, field) {
  let parsed;
  try { parsed = new URL(text(value, 3000)); }
  catch { throw createServiceError(`${field} must be a valid URL.`, 400, { field }); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw createServiceError(`${field} must use HTTP or HTTPS.`, 400, { field });
  return parsed.toString();
}

async function verifyGooglePageSpeed(connection) {
  const key = await credential(connection, "api_key");
  const pageUrl = publicHttpUrl(connection.metadata?.pageUrl, "pageUrl");
  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", pageUrl);
  url.searchParams.set("key", key);
  url.searchParams.set("category", "performance");
  const body = await requestJson(url);
  return { accountId: pageUrl, accountName: pageUrl, lighthouseVersion: body.lighthouseResult?.lighthouseVersion, fetchTime: body.lighthouseResult?.fetchTime };
}

async function verifyGoogleWebfonts(connection) {
  const key = await credential(connection, "api_key");
  const url = new URL("https://www.googleapis.com/webfonts/v1/webfonts");
  url.searchParams.set("key", key);
  url.searchParams.set("sort", "alpha");
  const body = await requestJson(url);
  const items = Array.isArray(body.items) ? body.items : [];
  return { accountId: "google-webfonts-api", accountName: "Google Web Fonts Developer API", fontCount: items.length };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE5 = Object.freeze({
  google_ad_manager: verifyGoogleAdManager,
  google_bigquery: verifyGoogleBigQuery,
  google_campaign_manager_360: verifyGoogleCampaignManager360,
  google_display_video_360: verifyGoogleDv360,
  google_merchant_center: verifyGoogleMerchantCenter,
  google_search_ads_360: verifyGoogleSa360,
  google_sheets: verifyGoogleSheets,
  google_pagespeed_insights: verifyGooglePageSpeed,
  google_webfonts: verifyGoogleWebfonts,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE5;