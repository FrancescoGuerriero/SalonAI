import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;
const MICROSOFT_ADS_TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_ADS_ACCOUNT_ENDPOINT = "https://clientcenter.api.bingads.microsoft.com/CustomerManagement/v13/Account/Query";

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
      throw createServiceError(`Microsoft Advertising account verification failed with HTTP ${response.status}.`, 409, {
        code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
        providerStatus: response.status,
      });
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createServiceError("Microsoft Advertising account verification timed out.", 504, {
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

async function microsoftAdsAccessToken(connection) {
  try {
    return await credential(connection, "access_token");
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }

  const clientId = text(connection.metadata?.clientId, 500);
  if (!clientId) throw createServiceError("Microsoft Advertising application/client ID is required.", 400, { field: "clientId" });
  const refreshToken = await credential(connection, "refresh_token");
  let clientSecret = "";
  try { clientSecret = await credential(connection, "client_secret"); }
  catch (error) {
    if (!["PROVIDER_CREDENTIAL_NOT_BOUND", "PROVIDER_CREDENTIAL_UNAVAILABLE"].includes(error?.code)) throw error;
  }

  const form = new URLSearchParams({
    client_id: clientId,
    scope: "https://ads.microsoft.com/msads.manage offline_access",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (clientSecret) form.set("client_secret", clientSecret);

  const body = await requestJson(MICROSOFT_ADS_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form.toString(),
  });
  const accessToken = text(body.access_token, 20000);
  if (!accessToken) {
    throw createServiceError("Microsoft Advertising OAuth refresh did not return an access token.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt,
    metadata: { refreshedBy: "microsoft_ads_verification" },
  }, { businessId: connection.business });

  const rotated = text(body.refresh_token, 20000);
  if (rotated && rotated !== refreshToken) {
    await storeProviderCredential(connection.app, connection._id, {
      role: "refresh_token",
      secret: rotated,
      metadata: { refreshedBy: "microsoft_ads_verification" },
    }, { businessId: connection.business });
  }
  return accessToken;
}

async function verifyMicrosoftAds(connection) {
  const accountId = text(connection.metadata?.accountId, 100).replace(/\D/g, "");
  if (!accountId) throw createServiceError("Microsoft Advertising account ID is required.", 400, { field: "accountId" });
  const accessToken = await microsoftAdsAccessToken(connection);
  const developerToken = await credential(connection, "api_key");
  const body = await requestJson(MICROSOFT_ADS_ACCOUNT_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      developertoken: developerToken,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ AccountId: Number(accountId), ReturnAdditionalFields: [] }),
  });
  const account = body.Account || body.account || {};
  if (!account.Id && !account.id) {
    throw createServiceError("Microsoft Advertising did not return the configured account.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  return {
    accountId: account.Id || account.id || accountId,
    accountName: account.Name || account.name || `Microsoft Ads ${accountId}`,
    currency: account.CurrencyCode || account.currencyCode,
    timezone: account.TimeZone || account.timeZone,
    status: account.AccountLifeCycleStatus || account.accountLifeCycleStatus,
  };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE6 = Object.freeze({
  microsoft_ads: verifyMicrosoftAds,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE6;