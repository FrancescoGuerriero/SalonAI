import { createHmac, randomBytes } from "node:crypto";

import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;
const META_GRAPH_VERSION = "v26.0";

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function encode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
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

async function verifyFacebookLeadAds(connection) {
  const token = await credential(connection, "access_token");
  const pageId = text(connection.metadata?.pageId, 100);
  if (!/^\d+$/.test(pageId)) throw createServiceError("Facebook Page ID is invalid.", 400, { field: "pageId" });
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/leadgen_forms`);
  url.searchParams.set("fields", "id,name,status");
  url.searchParams.set("limit", "1");
  const body = await requestJson(url, { headers: { authorization: `Bearer ${token}` } });
  return {
    accountId: pageId,
    accountName: body.data?.[0]?.name || `Facebook Lead Ads Page ${pageId}`,
    leadFormCountAtLeast: Array.isArray(body.data) ? body.data.length : 0,
  };
}

async function verifyThreads(connection) {
  const token = await credential(connection, "access_token");
  const url = new URL("https://graph.threads.net/v1.0/me");
  url.searchParams.set("fields", "id,username,threads_profile_picture_url,threads_biography");
  url.searchParams.set("access_token", token);
  const body = await requestJson(url);
  if (!body.id) throw createServiceError("Threads did not return the authenticated user.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: body.id, accountName: body.username, username: body.username };
}

async function verifyTikTokOrganic(connection) {
  const token = await credential(connection, "access_token");
  const url = new URL("https://open.tiktokapis.com/v2/user/info/");
  url.searchParams.set("fields", "open_id,union_id,display_name,username,is_verified");
  const body = await requestJson(url, { headers: { authorization: `Bearer ${token}` } });
  const user = body.data?.user || {};
  if (!user.open_id) throw createServiceError("TikTok did not return the authenticated user.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: user.open_id, accountName: user.display_name || user.username, username: user.username, verifiedProfile: Boolean(user.is_verified) };
}

function tiktokShopSignature(path, params, appSecret) {
  const keys = Object.keys(params).filter((key) => key !== "sign" && key !== "access_token").sort();
  const input = `${path}${keys.map((key) => `${key}${params[key]}`).join("")}`;
  return createHmac("sha256", appSecret).update(`${appSecret}${input}${appSecret}`).digest("hex");
}

async function verifyTikTokShop(connection) {
  const appKey = text(connection.metadata?.appKey, 300);
  if (!appKey) throw createServiceError("TikTok Shop app key is required.", 400, { field: "appKey" });
  const appSecret = await credential(connection, "client_secret");
  const token = await credential(connection, "access_token");
  const path = "/authorization/202309/shops";
  const params = { app_key: appKey, timestamp: Math.floor(Date.now() / 1000) };
  params.sign = tiktokShopSignature(path, params, appSecret);
  const url = new URL(`https://open-api.tiktokglobalshop.com${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const body = await requestJson(url, {
    headers: { "x-tts-access-token": token, "content-type": "application/json" },
  });
  if (Number(body.code || 0) !== 0) throw createServiceError(`TikTok Shop verification failed: ${text(body.message || "provider error", 500)}.`, 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const shops = body.data?.shops || body.data?.shop_list || [];
  const first = Array.isArray(shops) ? shops[0] : null;
  if (!first) throw createServiceError("TikTok Shop returned no authorized shops.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: first.id || first.shop_cipher, accountName: first.name || first.shop_name || "TikTok Shop", shopCipher: first.shop_cipher, shopCount: shops.length };
}

async function redditAccessToken(connection) {
  try { return await credential(connection, "access_token"); }
  catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId, 300);
  const secret = await credential(connection, "client_secret");
  const refresh = await credential(connection, "refresh_token");
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const body = await requestJson("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded", "user-agent": "SalonAI-MarketingHub/8B" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }).toString(),
  });
  const token = text(body.access_token, 20000);
  if (!token) throw createServiceError("Reddit did not issue an access token.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, { role: "access_token", secret: token, expiresAt, metadata: { refreshedBy: "reddit_ads_verification" } }, { businessId: connection.business });
  return token;
}

async function verifyRedditAds(connection) {
  const token = await redditAccessToken(connection);
  const adAccountId = text(connection.metadata?.adAccountId, 200);
  if (!adAccountId) throw createServiceError("Reddit ad account ID is required.", 400, { field: "adAccountId" });
  const body = await requestJson(`https://ads-api.reddit.com/api/v3/ad_accounts/${encodeURIComponent(adAccountId)}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json", "user-agent": "SalonAI-MarketingHub/8B" },
  });
  const account = body.data || body.ad_account || body;
  return { accountId: account.id || adAccountId, accountName: account.name || `Reddit Ads ${adAccountId}`, status: account.status, currency: account.currency };
}

async function verifySnapchatAds(connection) {
  const token = await credential(connection, "access_token");
  const organizationId = text(connection.metadata?.organizationId, 100);
  if (!/^[0-9a-fA-F-]{36}$/.test(organizationId)) throw createServiceError("Snap Organization ID is invalid.", 400, { field: "organizationId" });
  const body = await requestJson(`https://adsapi.snapchat.com/v1/organizations/${encodeURIComponent(organizationId)}/members`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (body.request_status !== "SUCCESS") throw createServiceError("Snapchat did not confirm organization access.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const members = Array.isArray(body.members) ? body.members : [];
  return { accountId: organizationId, accountName: members[0]?.display_name || `Snap Organization ${organizationId}`, memberCount: members.length };
}

async function verifyYandexMetrica(connection) {
  const token = await credential(connection, "access_token");
  const body = await requestJson("https://api-metrika.yandex.net/management/v1/counters?per_page=1", {
    headers: { authorization: `OAuth ${token}`, accept: "application/json" },
  });
  const counters = Array.isArray(body.counters) ? body.counters : [];
  return { accountId: counters[0]?.id || "yandex-metrica", accountName: counters[0]?.name || "Yandex Metrica", counterCountAtLeast: counters.length };
}

async function verifyTwilioTaskRouter(connection) {
  const accountSid = text(connection.metadata?.accountSid, 100);
  const workspaceSid = text(connection.metadata?.workspaceSid, 100);
  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid)) throw createServiceError("Twilio Account SID is invalid.", 400, { field: "accountSid" });
  if (!/^WS[0-9a-fA-F]{32}$/.test(workspaceSid)) throw createServiceError("TaskRouter Workspace SID is invalid.", 400, { field: "workspaceSid" });
  const authToken = await credential(connection, "client_secret");
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = await requestJson(`https://taskrouter.twilio.com/v1/Workspaces/${workspaceSid}`, {
    headers: { authorization: `Basic ${auth}`, accept: "application/json" },
  });
  return { accountId: body.sid || workspaceSid, accountName: body.friendly_name || `TaskRouter ${workspaceSid}`, accountSid: body.account_sid || accountSid, multiTaskEnabled: body.multi_task_enabled };
}

function oauth1Header(method, rawUrl, consumerKey, consumerSecret, accessToken, accessTokenSecret) {
  const url = new URL(rawUrl);
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  const params = [];
  for (const [key, value] of url.searchParams.entries()) params.push([key, value]);
  for (const [key, value] of Object.entries(oauth)) params.push([key, value]);
  params.sort((a, b) => encode(a[0]).localeCompare(encode(b[0])) || encode(a[1]).localeCompare(encode(b[1])));
  const parameterString = params.map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&");
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
  const baseString = `${method.toUpperCase()}&${encode(baseUrl)}&${encode(parameterString)}`;
  const signingKey = `${encode(consumerSecret)}&${encode(accessTokenSecret)}`;
  oauth.oauth_signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  return `OAuth ${Object.keys(oauth).sort().map((key) => `${encode(key)}="${encode(oauth[key])}"`).join(", ")}`;
}

async function xCredentials(connection) {
  const consumerKey = text(connection.metadata?.consumerKey, 300);
  if (!consumerKey) throw createServiceError("X consumer key is required.", 400, { field: "consumerKey" });
  return {
    consumerKey,
    consumerSecret: await credential(connection, "consumer_secret"),
    accessToken: await credential(connection, "access_token"),
    accessTokenSecret: await credential(connection, "access_token_secret"),
  };
}

async function verifyTwitterAds(connection) {
  const accountId = text(connection.metadata?.accountId, 200);
  if (!accountId) throw createServiceError("X Ads account ID is required.", 400, { field: "accountId" });
  const creds = await xCredentials(connection);
  const url = `https://ads-api.x.com/12/accounts/${encodeURIComponent(accountId)}`;
  const authorization = oauth1Header("GET", url, creds.consumerKey, creds.consumerSecret, creds.accessToken, creds.accessTokenSecret);
  const body = await requestJson(url, { headers: { authorization, accept: "application/json" } });
  const account = body.data || {};
  if (!account.id) throw createServiceError("X Ads did not return the configured advertiser account.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: account.id, accountName: account.name, timezone: account.timezone, currency: account.currency, approvalStatus: account.approval_status };
}

async function verifyTwitterOrganic(connection) {
  const creds = await xCredentials(connection);
  const url = "https://api.x.com/1.1/account/verify_credentials.json?include_email=false&skip_status=true";
  const authorization = oauth1Header("GET", url, creds.consumerKey, creds.consumerSecret, creds.accessToken, creds.accessTokenSecret);
  const body = await requestJson(url, { headers: { authorization, accept: "application/json" } });
  if (!body.id_str && !body.id) throw createServiceError("X did not return the authenticated user.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: body.id_str || body.id, accountName: body.screen_name || body.name, displayName: body.name, verifiedProfile: Boolean(body.verified) };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE7 = Object.freeze({
  facebook_lead_ads: verifyFacebookLeadAds,
  threads: verifyThreads,
  tiktok_organic: verifyTikTokOrganic,
  tiktok_shop: verifyTikTokShop,
  reddit_ads: verifyRedditAds,
  snapchat_ads: verifySnapchatAds,
  yandex_metrica: verifyYandexMetrica,
  twilio_taskrouter: verifyTwilioTaskRouter,
  twitter_ads: verifyTwitterAds,
  twitter_organic_legacy: verifyTwitterOrganic,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE7;