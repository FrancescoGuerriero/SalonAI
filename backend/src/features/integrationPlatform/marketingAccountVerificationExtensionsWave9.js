import dns from "node:dns/promises";
import net from "node:net";

import { createServiceError } from "../../shared/serviceError.js";
import { resolveProviderCredential, storeProviderCredential } from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;
const ATLAS_ACCEPT = "application/vnd.atlas.2025-03-12+json";

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
      catch { body = { raw: text(raw, 2000) }; }
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

function privateAddress(address) {
  if (net.isIPv4(address)) {
    const octets = address.split(".").map(Number);
    return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  }
  if (net.isIPv6(address)) {
    const normalised = address.toLowerCase();
    return normalised === "::1" || normalised.startsWith("fe80:") || normalised.startsWith("fc") || normalised.startsWith("fd");
  }
  return true;
}

async function publicHttpsOrigin(value, field) {
  let parsed;
  try { parsed = new URL(text(value, 1000)); }
  catch { throw createServiceError(`${field} must be a valid HTTPS URL.`, 400, { field }); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    throw createServiceError(`${field} must be a public HTTPS origin without embedded credentials or a custom port.`, 400, {
      field,
      code: "MARKETING_PROVIDER_ORIGIN_REJECTED",
    });
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || net.isIP(hostname)) {
    throw createServiceError(`${field} must not target localhost or a raw IP address.`, 400, {
      field,
      code: "MARKETING_PROVIDER_ORIGIN_REJECTED",
    });
  }
  const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some((entry) => privateAddress(entry.address))) {
    throw createServiceError(`${field} resolved to a private or unsafe network address.`, 400, {
      field,
      code: "MARKETING_PROVIDER_ORIGIN_REJECTED",
    });
  }
  return parsed.origin;
}

async function verifyMicrosoftClarity(connection) {
  const token = await credential(connection, "access_token");
  const url = new URL("https://www.clarity.ms/export-data/api/v1/project-live-insights");
  url.searchParams.set("numOfDays", "1");
  url.searchParams.set("dimension1", "Source");
  const body = await requestJson(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!Array.isArray(body)) {
    throw createServiceError("Microsoft Clarity did not return project insight data for this token.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  return {
    accountId: "clarity-project-token",
    accountName: "Microsoft Clarity project",
    metricGroups: body.length,
  };
}

async function verifyMntn(connection) {
  const key = await credential(connection, "api_key");
  const url = new URL("https://api3.mountain.com/apilist");
  url.searchParams.set("format", "json");
  url.searchParams.set("key", key);
  const body = await requestJson(url);
  if (!body || typeof body !== "object") {
    throw createServiceError("MNTN API 3.0 did not return reporting metadata.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  return {
    accountId: "mntn-reporting-api",
    accountName: "MNTN Reporting API 3.0",
    apiVersion: "3.0",
    metadataVerified: true,
  };
}

async function verifyGravityForms(connection) {
  const origin = await publicHttpsOrigin(connection.metadata?.siteUrl, "siteUrl");
  const consumerKey = text(connection.metadata?.consumerKey, 1000);
  if (!consumerKey) throw createServiceError("Gravity Forms consumer key is required.", 400, { field: "consumerKey" });
  const consumerSecret = await credential(connection, "consumer_secret");
  const authorization = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const body = await requestJson(`${origin}/wp-json/gf/v2/forms?paging%5Bpage_size%5D=1`, {
    headers: { authorization: `Basic ${authorization}`, accept: "application/json" },
  });
  const forms = Array.isArray(body) ? body : Array.isArray(body.forms) ? body.forms : [];
  return {
    accountId: origin,
    accountName: `Gravity Forms at ${new URL(origin).hostname}`,
    formCountAtLeast: forms.length,
  };
}

async function verifyMongoDbAtlas(connection) {
  const clientId = text(connection.metadata?.clientId, 1000);
  if (!clientId) throw createServiceError("Atlas Service Account client ID is required.", 400, { field: "clientId" });
  const clientSecret = await credential(connection, "client_secret");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenBody = await requestJson("https://cloud.mongodb.com/api/oauth/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  const accessToken = text(tokenBody.access_token, 20000);
  if (!accessToken) throw createServiceError("MongoDB Atlas did not issue a Service Account access token.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const expiresAt = new Date(Date.now() + Math.max(60, Number(tokenBody.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt,
    metadata: { refreshedBy: "mongodb_atlas_verification" },
  }, { businessId: connection.business });
  const body = await requestJson("https://cloud.mongodb.com/api/atlas/v2/orgs?itemsPerPage=1&pageNum=1", {
    headers: { authorization: `Bearer ${accessToken}`, accept: ATLAS_ACCEPT },
  });
  const orgs = Array.isArray(body.results) ? body.results : [];
  if (!orgs.length) throw createServiceError("MongoDB Atlas Service Account has no accessible organization.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const org = orgs[0];
  return { accountId: org.id, accountName: org.name, organizationCountAtLeast: orgs.length };
}

async function lyAdsAccessToken(connection) {
  try { return await credential(connection, "access_token"); }
  catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId, 1000);
  const clientSecret = await credential(connection, "client_secret");
  const refreshToken = await credential(connection, "refresh_token");
  const body = await requestJson("https://biz-oauth.yahoo.co.jp/oauth/v1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });
  const accessToken = text(body.access_token, 20000);
  if (!accessToken) throw createServiceError("LY Ads OAuth did not issue an access token.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt,
    metadata: { refreshedBy: "ly_ads_verification" },
  }, { businessId: connection.business });
  return accessToken;
}

async function verifyLyAds(connection) {
  const token = await lyAdsAccessToken(connection);
  const body = await requestJson("https://ads-search.yahooapis.jp/api/v20/BaseAccountService/get", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ numberResults: 1, startIndex: 1 }),
  });
  const values = Array.isArray(body.rval?.values) ? body.rval.values : Array.isArray(body.values) ? body.values : [];
  const account = values[0]?.account || values[0] || null;
  if (!account) throw createServiceError("LY Ads returned no account available to the authorised Business ID.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return {
    accountId: account.accountId,
    accountName: account.accountName,
    status: account.accountStatus,
    authorizationBusinessId: body.rval?.authorizationBusinessId || body.authorizationBusinessId,
    apiVersion: "v20",
  };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE9 = Object.freeze({
  microsoft_clarity: verifyMicrosoftClarity,
  mntn: verifyMntn,
  gravity_forms: verifyGravityForms,
  mongodb: verifyMongoDbAtlas,
  yahoo_japan: verifyLyAds,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE9;