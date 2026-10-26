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

async function credential(connection, role) {
  return (await resolveProviderCredential(connection, role)).secret;
}

async function verifyPinterest(connection) {
  const token = await credential(connection, "access_token");
  const body = await requestJson("https://api.pinterest.com/v5/user_account", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  return {
    accountId: body.id,
    accountName: body.business_name || body.username,
    username: body.username,
    accountType: body.account_type,
    websiteUrl: body.website_url,
  };
}

async function verifySlack(connection) {
  const token = await credential(connection, "access_token");
  const body = await requestJson("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: "",
  });
  if (body.ok !== true) {
    throw createServiceError(`Slack authentication failed: ${text(body.error || "unknown error", 300)}.`, 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  return {
    accountId: body.team_id,
    accountName: body.team,
    userId: body.user_id,
    userName: body.user,
    enterpriseId: body.enterprise_id,
  };
}

async function verifyZoom(connection) {
  const accountId = text(connection.metadata?.accountId, 500);
  const clientId = text(connection.metadata?.clientId, 500);
  if (!accountId || !clientId) {
    throw createServiceError("Zoom account ID and client ID are required.", 400);
  }
  const secret = await credential(connection, "client_secret");
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", accountId);
  const tokenBody = await requestJson(tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
  });
  const accessToken = text(tokenBody.access_token, 20000);
  if (!accessToken) {
    throw createServiceError("Zoom did not issue a Server-to-Server OAuth access token.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  const expiresAt = new Date(Date.now() + Math.max(60, Number(tokenBody.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt,
    metadata: { refreshedBy: "zoom_s2s_verification" },
  }, { businessId: connection.business });
  const user = await requestJson("https://api.zoom.us/v2/users/me", {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  return {
    accountId,
    accountName: user.display_name || `${text(user.first_name, 100)} ${text(user.last_name, 100)}`.trim(),
    userId: user.id,
    email: user.email,
    status: user.status,
  };
}

async function spotifyAccessToken(connection) {
  try {
    return await credential(connection, "access_token");
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId, 500);
  const clientSecret = await credential(connection, "client_secret");
  const refreshToken = await credential(connection, "refresh_token");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = await requestJson("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
  });
  const token = text(body.access_token, 20000);
  if (!token) {
    throw createServiceError("Spotify did not issue an Ads API access token.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: token,
    expiresAt,
    metadata: { refreshedBy: "spotify_ads_verification" },
  }, { businessId: connection.business });
  return token;
}

async function verifySpotifyAds(connection) {
  const token = await spotifyAccessToken(connection);
  const body = await requestJson("https://api-partner.spotify.com/ads/v3/businesses", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const businesses = Array.isArray(body.businesses) ? body.businesses : [];
  if (!businesses.length) {
    throw createServiceError("The authenticated Spotify account has no accessible Ads API business.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  const first = businesses[0];
  return {
    accountId: first.id,
    accountName: first.name,
    status: first.status,
    accountType: first.type,
    businessCount: businesses.length,
  };
}

function salesforceOrigin(value) {
  let parsed;
  try { parsed = new URL(text(value, 1000)); }
  catch { throw createServiceError("Salesforce instance URL is invalid.", 400, { field: "instanceUrl" }); }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || !(hostname === "salesforce.com" || hostname.endsWith(".salesforce.com"))) {
    throw createServiceError("Salesforce instance URL must use an HTTPS salesforce.com host.", 400, {
      field: "instanceUrl",
      code: "MARKETING_PROVIDER_ORIGIN_REJECTED",
    });
  }
  return parsed.origin;
}

async function verifySalesforce(connection) {
  const token = await credential(connection, "access_token");
  const origin = salesforceOrigin(connection.metadata?.instanceUrl);
  const body = await requestJson(`${origin}/services/oauth2/userinfo`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  return {
    accountId: body.organization_id,
    accountName: body.preferred_username || body.name,
    userId: body.user_id || body.sub,
    displayName: body.name,
    email: body.email,
  };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS = Object.freeze({
  pinterest_ads: verifyPinterest,
  pinterest_organic: verifyPinterest,
  slack: verifySlack,
  zoom: verifyZoom,
  spotify_ads: verifySpotifyAds,
  salesforce: verifySalesforce,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS;