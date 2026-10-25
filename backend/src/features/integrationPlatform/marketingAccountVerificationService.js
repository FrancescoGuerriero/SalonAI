import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import { resolveProviderCredential } from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;
const GITHUB_API_VERSION = "2026-03-10";
const SQUARE_API_VERSION = "2026-09-16";
const SHOPIFY_API_VERSION = "2026-10";

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