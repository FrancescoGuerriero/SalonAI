import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;
const GITHUB_API_VERSION = "2026-03-10";
const SQUARE_API_VERSION = "2026-09-16";
const SHOPIFY_API_VERSION = "2026-10";
const LINKEDIN_MARKETING_VERSION = "202610";
const GOOGLE_ADS_API_VERSION = "v26";
const META_GRAPH_VERSION = "v26.0";

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function safeSummary(value = {}) {
  const result = {};
  for (const [key, raw] of Object.entries(value || {})) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      result[key] = typeof raw === "string" ? text(raw, 500) : raw;
    }
  }
  return result;
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
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

async function bearer(connection, role = "access_token") {
  return (await resolveProviderCredential(connection, role)).secret;
}

async function apiKey(connection) {
  return (await resolveProviderCredential(connection, "api_key")).secret;
}

async function clientSecret(connection) {
  return (await resolveProviderCredential(connection, "client_secret")).secret;
}

async function refreshToken(connection) {
  return (await resolveProviderCredential(connection, "refresh_token")).secret;
}

async function googleAccessToken(connection) {
  try {
    return await bearer(connection);
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId || connection.metadata?.oauthClientId, 500);
  if (!clientId) throw createServiceError("Google OAuth client ID is required.", 409);
  const secret = await clientSecret(connection);
  const refresh = await refreshToken(connection);
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const body = await requestJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const access = text(body.access_token, 20000);
  if (!access) throw createServiceError("Google OAuth refresh did not return an access token.", 409);
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: access,
    expiresAt,
    metadata: { refreshedBy: "marketing_account_verification" },
  }, { businessId: connection.business });
  return access;
}

async function verifyOpenAiAds(connection) {
  const key = await apiKey(connection);
  const body = await requestJson("https://api.ads.openai.com/v1/ad_account", {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
  });
  return { accountId: body.id, accountName: body.name, status: body.status, currency: body.currency_code, timezone: body.timezone };
}

async function verifySendGrid(connection) {
  const key = await apiKey(connection);
  const body = await requestJson("https://api.sendgrid.com/v3/user/profile", {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
  });
  return { accountId: body.user_id || body.id, accountName: body.username || body.first_name || body.email, email: body.email };
}

async function verifyGitHub(connection) {
  const token = await bearer(connection);
  const body = await requestJson("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": GITHUB_API_VERSION,
      "user-agent": "SalonAI-MarketingHub",
    },
  });
  return { accountId: body.id, accountName: body.login, displayName: body.name, accountUrl: body.html_url };
}

async function verifyGitLab(connection) {
  const token = await bearer(connection);
  const body = await requestJson("https://gitlab.com/api/v4/user", {
    headers: { "PRIVATE-TOKEN": token, accept: "application/json" },
  });
  return { accountId: body.id, accountName: body.username, displayName: body.name, accountUrl: body.web_url };
}

async function verifyTwilio(connection) {
  const accountSid = text(connection.metadata?.accountSid, 100);
  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid)) {
    throw createServiceError("Twilio Account SID is invalid.", 400, { field: "accountSid" });
  }
  const secret = await clientSecret(connection);
  const auth = Buffer.from(`${accountSid}:${secret}`).toString("base64");
  const body = await requestJson(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`, {
    headers: { authorization: `Basic ${auth}`, accept: "application/json" },
  });
  return { accountId: body.sid, accountName: body.friendly_name, status: body.status, accountType: body.type };
}

async function verifyStripe(connection) {
  const key = await apiKey(connection);
  const body = await requestJson("https://api.stripe.com/v1/account", {
    headers: { authorization: `Bearer ${key}` },
  });
  return { accountId: body.id, accountName: body.business_profile?.name || body.settings?.dashboard?.display_name, country: body.country, defaultCurrency: body.default_currency };
}

async function verifyShopify(connection) {
  const token = await bearer(connection);
  const shopDomain = text(connection.metadata?.shopDomain, 300).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    throw createServiceError("Shopify shopDomain must be a canonical *.myshopify.com domain.", 400, { field: "shopDomain" });
  }
  const body = await requestJson(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: { "X-Shopify-Access-Token": token, accept: "application/json" },
  });
  return { accountId: body.shop?.id, accountName: body.shop?.name, shopDomain: body.shop?.myshopify_domain, currency: body.shop?.currency };
}

async function verifyHubSpot(connection) {
  const token = await bearer(connection);
  const body = await requestJson("https://api.hubapi.com/account-info/v3/details", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  return { accountId: body.portalId, accountName: body.accountName, accountType: body.uiDomain };
}

async function verifySquare(connection) {
  const token = await bearer(connection);
  const body = await requestJson("https://connect.squareup.com/v2/locations", {
    headers: {
      authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_API_VERSION,
      accept: "application/json",
    },
  });
  const locations = Array.isArray(body.locations) ? body.locations : [];
  return { accountId: locations[0]?.merchant_id || "", accountName: locations[0]?.name || "Square seller", locationCount: locations.length };
}

async function verifyPayPal(connection) {
  const clientId = text(connection.metadata?.clientId, 500);
  if (!clientId) throw createServiceError("PayPal client ID is required.", 400, { field: "clientId" });
  const secret = await clientSecret(connection);
  const environment = text(connection.metadata?.environment || "live", 20).toLowerCase();
  if (!["live", "sandbox"].includes(environment)) {
    throw createServiceError("PayPal environment must be live or sandbox.", 400, { field: "environment" });
  }
  const origin = environment === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const body = await requestJson(`${origin}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  if (!body.access_token) {
    throw createServiceError("PayPal did not issue an access token for these credentials.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  return { accountId: clientId, accountName: "PayPal", environment, scope: text(body.scope, 500) };
}

async function verifyMetaAds(connection) {
  const token = await bearer(connection);
  const rawId = text(connection.metadata?.adAccountId, 100);
  const accountId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;
  const body = await requestJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(accountId)}?fields=id,name,account_status,currency,timezone_name`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { accountId: body.id, accountName: body.name, status: body.account_status, currency: body.currency, timezone: body.timezone_name };
}

async function verifyFacebookPages(connection) {
  const token = await bearer(connection);
  const pageId = text(connection.metadata?.pageId, 100);
  const body = await requestJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pageId)}?fields=id,name`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { accountId: body.id, accountName: body.name };
}

async function verifyInstagramOrganic(connection) {
  const token = await bearer(connection);
  const accountId = text(connection.metadata?.instagramProfessionalAccountId, 100);
  const body = await requestJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(accountId)}?fields=id,username,name`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { accountId: body.id, accountName: body.username || body.name, displayName: body.name };
}

async function verifyTikTokAds(connection) {
  const token = await bearer(connection);
  const advertiserId = text(connection.metadata?.advertiserId, 100);
  const url = new URL("https://business-api.tiktok.com/open_api/v1.3/identity/get/");
  url.searchParams.set("advertiser_id", advertiserId);
  url.searchParams.set("page_size", "1");
  const body = await requestJson(url, { headers: { "Access-Token": token } });
  if (Number(body.code || 0) !== 0) {
    throw createServiceError(`TikTok verification failed: ${text(body.message || "provider error", 500)}.`, 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  return { accountId: advertiserId, accountName: `TikTok advertiser ${advertiserId}`, identityCount: Array.isArray(body.data?.identity_list) ? body.data.identity_list.length : 0 };
}

async function verifyMailchimp(connection) {
  const key = await apiKey(connection);
  const prefix = text(connection.metadata?.serverPrefix, 40).toLowerCase();
  if (!/^[a-z]{2}\d+$/.test(prefix)) throw createServiceError("Mailchimp server prefix is invalid.", 400, { field: "serverPrefix" });
  const auth = Buffer.from(`anystring:${key}`).toString("base64");
  const body = await requestJson(`https://${prefix}.api.mailchimp.com/3.0/ping`, {
    headers: { authorization: `Basic ${auth}` },
  });
  return { accountId: prefix, accountName: "Mailchimp", healthStatus: body.health_status };
}

async function verifyGa4(connection) {
  const token = await googleAccessToken(connection);
  const propertyId = text(connection.metadata?.propertyId, 80).replace(/^properties\//, "");
  const body = await requestJson(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ dateRanges: [{ startDate: "7daysAgo", endDate: "today" }], metrics: [{ name: "activeUsers" }], limit: 1 }),
  });
  return { accountId: propertyId, accountName: `GA4 property ${propertyId}`, rowCount: Number(body.rowCount || 0) };
}

async function verifySearchConsole(connection) {
  const token = await googleAccessToken(connection);
  const siteUrl = text(connection.metadata?.siteUrl, 1000);
  const body = await requestJson("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { authorization: `Bearer ${token}` },
  });
  const entries = Array.isArray(body.siteEntry) ? body.siteEntry : [];
  const match = entries.find((entry) => entry.siteUrl === siteUrl);
  if (!match) throw createServiceError("Search Console property is not accessible to these credentials.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: siteUrl, accountName: siteUrl, permissionLevel: match.permissionLevel };
}

async function verifyYouTube(connection) {
  const token = await googleAccessToken(connection);
  const body = await requestJson("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=1", {
    headers: { authorization: `Bearer ${token}` },
  });
  const channel = Array.isArray(body.items) ? body.items[0] : null;
  if (!channel) throw createServiceError("No YouTube channel is available to the authenticated account.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const configuredChannelId = text(connection.metadata?.channelId, 100);
  if (configuredChannelId && configuredChannelId !== channel.id) {
    throw createServiceError("The authenticated YouTube channel does not match the configured channel ID.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  }
  return { accountId: channel.id, accountName: channel.snippet?.title };
}

async function verifyGoogleBusinessProfile(connection) {
  const token = await googleAccessToken(connection);
  const configuredAccount = text(connection.metadata?.accountId, 200);
  const body = await requestJson("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { authorization: `Bearer ${token}` },
  });
  const accounts = Array.isArray(body.accounts) ? body.accounts : [];
  const account = accounts.find((item) => item.name === configuredAccount || item.name?.endsWith(`/${configuredAccount.replace(/^accounts\//, "")}`));
  if (!account) throw createServiceError("Google Business Profile account is not accessible to these credentials.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: account.name, accountName: account.accountName || account.name, accountType: account.type };
}

async function verifyGoogleAds(connection) {
  const token = await googleAccessToken(connection);
  const developerToken = await apiKey(connection);
  const customerId = text(connection.metadata?.customerId, 80).replace(/\D/g, "");
  if (!customerId) throw createServiceError("Google Ads customer ID is required.", 400, { field: "customerId" });
  const headers = {
    authorization: `Bearer ${token}`,
    "developer-token": developerToken,
    "content-type": "application/json",
  };
  const loginCustomerId = text(connection.metadata?.loginCustomerId, 80).replace(/\D/g, "");
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  const body = await requestJson(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1", pageSize: 1 }),
  });
  const customer = body.results?.[0]?.customer || {};
  return { accountId: customer.id || customerId, accountName: customer.descriptiveName || `Google Ads ${customerId}`, currency: customer.currencyCode, timezone: customer.timeZone };
}

function linkedInId(value, prefix) {
  return text(value, 300).replace(prefix, "").replace(/\D/g, "");
}

async function verifyLinkedInAds(connection) {
  const token = await bearer(connection);
  const accountId = linkedInId(connection.metadata?.adAccountUrn, "urn:li:sponsoredAccount:");
  const body = await requestJson(`https://api.linkedin.com/rest/adAccounts/${encodeURIComponent(accountId)}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "Linkedin-Version": LINKEDIN_MARKETING_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  return { accountId: body.id || accountId, accountName: body.name, status: body.status, currency: body.currency };
}

async function verifyLinkedInPages(connection) {
  const token = await bearer(connection);
  const organizationId = linkedInId(connection.metadata?.organisationUrn, "urn:li:organization:");
  const body = await requestJson(`https://api.linkedin.com/rest/organizations/${encodeURIComponent(organizationId)}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "Linkedin-Version": LINKEDIN_MARKETING_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  return { accountId: body.id || organizationId, accountName: body.localizedName || body.vanityName || `LinkedIn organization ${organizationId}` };
}

export const MARKETING_ACCOUNT_VERIFIERS = Object.freeze({
  openai_ads: verifyOpenAiAds,
  sendgrid: verifySendGrid,
  github: verifyGitHub,
  gitlab: verifyGitLab,
  twilio: verifyTwilio,
  stripe: verifyStripe,
  shopify: verifyShopify,
  hubspot: verifyHubSpot,
  square: verifySquare,
  paypal_transactions: verifyPayPal,
  meta_ads: verifyMetaAds,
  facebook_pages: verifyFacebookPages,
  instagram_organic: verifyInstagramOrganic,
  tiktok_ads: verifyTikTokAds,
  mailchimp: verifyMailchimp,
  ga4: verifyGa4,
  google_search_console: verifySearchConsole,
  youtube_analytics: verifyYouTube,
  google_business_profile: verifyGoogleBusinessProfile,
  google_ads: verifyGoogleAds,
  linkedin_ads: verifyLinkedInAds,
  linkedin_pages: verifyLinkedInPages,
});

export function marketingAccountVerifierAvailable(provider) {
  return Boolean(MARKETING_ACCOUNT_VERIFIERS[String(provider || "").trim().toLowerCase()]);
}

export async function verifyMarketingConnectedAccount(provider, { businessId } = {}) {
  const key = String(provider || "").trim().toLowerCase();
  const verifier = MARKETING_ACCOUNT_VERIFIERS[key];
  if (!verifier) {
    throw createServiceError(`A live account verifier is not implemented for ${key || "this provider"}.`, 409, {
      code: "MARKETING_PROVIDER_VERIFIER_NOT_AVAILABLE",
      provider: key,
    });
  }
  const connection = await IntegrationConnection.findOne({ business: businessId, provider: key });
  if (!connection || ["revoked", "disconnected"].includes(connection.status)) {
    throw createServiceError("Marketing provider connection is not available for verification.", 404);
  }

  try {
    const account = safeSummary(await verifier(connection));
    const now = new Date();
    connection.status = "connected";
    connection.connectedAt = now;
    connection.metadata = {
      ...(connection.metadata?.toObject?.() || connection.metadata || {}),
      verificationStatus: "verified",
      verifiedAt: now,
      verifiedAccount: account,
      verificationErrorCode: "",
    };
    await connection.save();
    return { verified: true, provider: key, verifiedAt: now, account };
  } catch (error) {
    connection.status = "pending";
    connection.connectedAt = null;
    connection.metadata = {
      ...(connection.metadata?.toObject?.() || connection.metadata || {}),
      verificationStatus: "failed",
      verifiedAt: null,
      verificationErrorCode: text(error?.code || "MARKETING_PROVIDER_VERIFICATION_FAILED", 120),
      verifiedAccount: null,
    };
    await connection.save();
    throw error;
  }
}

export default {
  MARKETING_ACCOUNT_VERIFIERS,
  marketingAccountVerifierAvailable,
  verifyMarketingConnectedAccount,
};