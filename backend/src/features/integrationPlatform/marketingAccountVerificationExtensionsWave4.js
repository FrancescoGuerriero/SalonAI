import {
  createHash,
  createHmac,
  sign as cryptoSign,
} from "node:crypto";

import { createServiceError } from "../../shared/serviceError.js";
import {
  resolveProviderCredential,
  storeProviderCredential,
} from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;
const AMAZON_LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const AMAZON_ADS_ORIGINS = Object.freeze({
  NA: "https://advertising-api.amazon.com",
  EU: "https://advertising-api-eu.amazon.com",
  FE: "https://advertising-api-fe.amazon.com",
});
const AMAZON_SP_ORIGINS = Object.freeze({
  NA: "https://sellingpartnerapi-na.amazon.com",
  EU: "https://sellingpartnerapi-eu.amazon.com",
  FE: "https://sellingpartnerapi-fe.amazon.com",
});

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function upper(value, max = 20) {
  return text(value, max).toUpperCase();
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding = undefined) {
  const digest = createHmac("sha256", key).update(value).digest();
  return encoding === "hex" ? digest.toString("hex") : digest;
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

function amazonRegionOrigin(region, origins, field = "region") {
  const key = upper(region);
  const origin = origins[key];
  if (!origin) {
    throw createServiceError(`${field} must be one of: ${Object.keys(origins).join(", ")}.`, 400, { field });
  }
  return { key, origin };
}

async function amazonLwaAccessToken(connection, refreshedBy) {
  try {
    return await credential(connection, "access_token");
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId, 500);
  if (!clientId) throw createServiceError("Amazon Login with Amazon client ID is required.", 400, { field: "clientId" });
  const clientSecret = await credential(connection, "client_secret");
  const refreshToken = await credential(connection, "refresh_token");
  const body = await requestJson(AMAZON_LWA_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  const accessToken = text(body.access_token, 20000);
  if (!accessToken) {
    throw createServiceError("Login with Amazon did not issue an access token.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  const expiresAt = new Date(Date.now() + Math.max(60, finite(body.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt,
    metadata: { refreshedBy },
  }, { businessId: connection.business });
  const rotatedRefresh = text(body.refresh_token, 20000);
  if (rotatedRefresh && rotatedRefresh !== refreshToken) {
    await storeProviderCredential(connection.app, connection._id, {
      role: "refresh_token",
      secret: rotatedRefresh,
      metadata: { refreshedBy },
    }, { businessId: connection.business });
  }
  return accessToken;
}

async function verifyAmazonAdsBase(connection, accountType) {
  const token = await amazonLwaAccessToken(connection, `amazon_${accountType}_verification`);
  const clientId = text(connection.metadata?.clientId, 500);
  const { key: region, origin } = amazonRegionOrigin(connection.metadata?.region, AMAZON_ADS_ORIGINS);
  const profiles = await requestJson(`${origin}/v2/profiles`, {
    headers: {
      authorization: `Bearer ${token}`,
      "Amazon-Advertising-API-ClientId": clientId,
      accept: "application/json",
    },
  });
  const list = Array.isArray(profiles) ? profiles : [];
  if (!list.length) {
    throw createServiceError("The Amazon Ads authorization has no accessible advertiser profiles.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  const first = list[0] || {};
  return {
    accountId: first.profileId,
    accountName: first.accountInfo?.name || `Amazon Ads profile ${first.profileId}`,
    accountType: first.accountInfo?.type || accountType,
    currency: first.currencyCode,
    country: first.countryCode,
    region,
    profileCount: list.length,
  };
}

async function verifyAmazonAds(connection) {
  return verifyAmazonAdsBase(connection, "advertising");
}

async function verifyAmazonDsp(connection) {
  return verifyAmazonAdsBase(connection, "dsp");
}

async function spAccessToken(connection, source) {
  return amazonLwaAccessToken(connection, source);
}

function spHeaders(accessToken) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    "x-amz-access-token": accessToken,
    "x-amz-date": amzDate,
    "user-agent": "SalonAI/8B (Language=JavaScript/Node.js)",
    accept: "application/json",
  };
}

async function verifyAmazonSellerCentral(connection) {
  const token = await spAccessToken(connection, "amazon_seller_central_verification");
  const { key: region, origin } = amazonRegionOrigin(connection.metadata?.region, AMAZON_SP_ORIGINS);
  const body = await requestJson(`${origin}/sellers/v1/marketplaceParticipations`, {
    headers: spHeaders(token),
  });
  const list = Array.isArray(body.payload) ? body.payload : [];
  if (!list.length) {
    throw createServiceError("Amazon Seller Central returned no marketplace participations.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  const first = list[0] || {};
  return {
    accountId: first.marketplace?.id || region,
    accountName: first.participation?.storeName || first.marketplace?.name || "Amazon Seller Central",
    country: first.marketplace?.countryCode,
    region,
    marketplaceCount: list.length,
  };
}

async function verifyAmazonVendorCentral(connection) {
  const token = await spAccessToken(connection, "amazon_vendor_central_verification");
  const { key: region, origin } = amazonRegionOrigin(connection.metadata?.region, AMAZON_SP_ORIGINS);
  const createdBefore = new Date(Date.now() - 2 * 60 * 1000);
  const createdAfter = new Date(createdBefore.getTime() - 24 * 60 * 60 * 1000);
  const url = new URL(`${origin}/vendor/orders/v1/purchaseOrders`);
  url.searchParams.set("createdAfter", createdAfter.toISOString());
  url.searchParams.set("createdBefore", createdBefore.toISOString());
  url.searchParams.set("limit", "1");
  url.searchParams.set("sortOrder", "DESC");
  const body = await requestJson(url, { headers: spHeaders(token) });
  return {
    accountId: region,
    accountName: "Amazon Vendor Central",
    region,
    purchaseOrderAccessVerified: Boolean(body?.payload || body?.pagination || body),
  };
}

function awsRegion(value) {
  const region = text(value, 80).toLowerCase();
  if (!/^[a-z]{2}(?:-gov)?-[a-z0-9-]+-\d$/.test(region)) {
    throw createServiceError("AWS region is invalid.", 400, { field: "region" });
  }
  return region;
}

function awsTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function awsDate(amzDate) {
  return amzDate.slice(0, 8);
}

async function verifyAmazonSqs(connection) {
  const accessKeyId = text(connection.metadata?.accessKeyId, 200);
  if (!/^[A-Z0-9]{16,128}$/.test(accessKeyId)) {
    throw createServiceError("AWS access key ID is invalid.", 400, { field: "accessKeyId" });
  }
  const secretAccessKey = await credential(connection, "secret_access_key");
  let sessionToken = "";
  try { sessionToken = await credential(connection, "session_token"); }
  catch (error) {
    if (!["PROVIDER_CREDENTIAL_NOT_BOUND", "PROVIDER_CREDENTIAL_UNAVAILABLE"].includes(error?.code)) throw error;
  }
  const region = awsRegion(connection.metadata?.region);
  const service = "sqs";
  const host = `sqs.${region}.amazonaws.com`;
  const url = `https://${host}/`;
  const target = "AmazonSQS.ListQueues";
  const payload = JSON.stringify({ MaxResults: 1 });
  const payloadHash = sha256(payload);
  const amzDate = awsTimestamp();
  const dateStamp = awsDate(amzDate);
  const canonicalHeaders = [
    `content-type:application/x-amz-json-1.0\n`,
    `host:${host}\n`,
    `x-amz-date:${amzDate}\n`,
    ...(sessionToken ? [`x-amz-security-token:${sessionToken}\n`] : []),
    `x-amz-target:${target}\n`,
  ].join("");
  const signedHeaders = [
    "content-type",
    "host",
    "x-amz-date",
    ...(sessionToken ? ["x-amz-security-token"] : []),
    "x-amz-target",
  ].join(";");
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers = {
    authorization,
    "content-type": "application/x-amz-json-1.0",
    "x-amz-date": amzDate,
    "x-amz-target": target,
  };
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;
  const body = await requestJson(url, { method: "POST", headers, body: payload });
  const queues = Array.isArray(body.QueueUrls) ? body.QueueUrls : [];
  return {
    accountId: accessKeyId.slice(-4),
    accountName: `AWS SQS ${region}`,
    region,
    queueCountAtLeast: queues.length,
  };
}

function appleClientSecret(clientId, teamId, keyId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 300,
    aud: "https://appleid.apple.com",
    sub: clientId,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  let signature;
  try {
    signature = cryptoSign("sha256", Buffer.from(signingInput), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    });
  } catch {
    throw createServiceError("Apple Ads private key could not sign an ES256 client secret.", 400, {
      field: "privateKey",
      code: "APPLE_ADS_PRIVATE_KEY_INVALID",
    });
  }
  return `${signingInput}.${signature.toString("base64url")}`;
}

async function verifyAppleSearchAds(connection) {
  const clientId = text(connection.metadata?.clientId, 500);
  const teamId = text(connection.metadata?.teamId, 500);
  const keyId = text(connection.metadata?.keyId, 500);
  if (!clientId || !teamId || !keyId) {
    throw createServiceError("Apple Ads client ID, team ID and key ID are required.", 400);
  }
  const privateKey = await credential(connection, "private_key");
  const clientSecret = appleClientSecret(clientId, teamId, keyId, privateKey);
  const tokenBody = await requestJson("https://appleid.apple.com/auth/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "searchadsorg",
    }).toString(),
  });
  const accessToken = text(tokenBody.access_token, 20000);
  if (!accessToken) {
    throw createServiceError("Apple Ads did not issue an access token.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  const expiresAt = new Date(Date.now() + Math.max(60, finite(tokenBody.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, {
    role: "access_token",
    secret: accessToken,
    expiresAt,
    metadata: { refreshedBy: "apple_ads_verification" },
  }, { businessId: connection.business });
  const me = await requestJson("https://api.ads.apple.com/v1/me", {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  const result = me.result || {};
  if (!result.userId || !result.orgId) {
    throw createServiceError("Apple Ads /v1/me did not return an API user and organization.", 409, {
      code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
    });
  }
  return {
    accountId: result.orgId,
    accountName: `Apple Ads organization ${result.orgId}`,
    userId: result.userId,
    organizationId: result.orgId,
  };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE4 = Object.freeze({
  amazon_ads: verifyAmazonAds,
  amazon_dsp: verifyAmazonDsp,
  amazon_seller_central: verifyAmazonSellerCentral,
  amazon_vendor_central: verifyAmazonVendorCentral,
  amazon_sqs: verifyAmazonSqs,
  apple_search_ads: verifyAppleSearchAds,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE4;