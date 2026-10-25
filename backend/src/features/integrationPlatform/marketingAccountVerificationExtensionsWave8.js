import { createServiceError } from "../../shared/serviceError.js";
import { resolveProviderCredential, storeProviderCredential } from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "error" });
    const raw = await response.text();
    if (!response.ok) {
      throw createServiceError(`Provider account verification failed with HTTP ${response.status}.`, 409, {
        code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
        providerStatus: response.status,
      });
    }
    let body = raw;
    try { body = raw ? JSON.parse(raw) : {}; } catch {}
    return { body, raw };
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

async function verifyDockerHub(connection) {
  const username = text(connection.metadata?.username, 200);
  const pat = await credential(connection, "api_key");
  const { body } = await request("https://hub.docker.com/v2/auth/token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ identifier: username, secret: pat }),
  });
  const token = text(body.access_token || body.token, 20000);
  if (!token) throw createServiceError("Docker Hub did not issue an authenticated token.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const repos = await request(`https://hub.docker.com/v2/namespaces/${encodeURIComponent(username)}/repositories?page_size=1`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  return { accountId: username, accountName: username, repositoryCount: Number(repos.body?.count || 0) };
}

async function verifySemrush(connection) {
  const key = await credential(connection, "api_key");
  const url = new URL("https://www.semrush.com/users/countapiunits.html");
  url.searchParams.set("key", key);
  const { raw } = await request(url);
  const units = Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(units)) throw createServiceError("Semrush API key did not return an API-unit balance.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: "semrush-api", accountName: "Semrush", apiUnitsRemaining: units };
}

async function verifyReply(connection) {
  const key = await credential(connection, "api_key");
  const { body } = await request("https://api.reply.io/v3/rate-limits", {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
  });
  return { accountId: body.userId || body.user_id || "reply-api", accountName: body.email || body.userEmail || "Reply.io", limitsVerified: true };
}

const SURVEYSPARROW_ORIGINS = Object.freeze({
  US: "https://api.surveysparrow.com",
  EU: "https://eu-api.surveysparrow.com",
  AP: "https://ap-api.surveysparrow.com",
  ME: "https://me-api.surveysparrow.com",
  UK: "https://eu-ln-api.surveysparrow.com",
  "AP-SY": "https://ap-sy-api.surveysparrow.com",
  CA: "https://ca-api.surveysparrow.com",
});

async function verifySurveySparrow(connection) {
  const region = text(connection.metadata?.region, 20).toUpperCase();
  const origin = SURVEYSPARROW_ORIGINS[region];
  if (!origin) throw createServiceError("SurveySparrow region is invalid.", 400, { field: "region" });
  const token = await credential(connection, "access_token");
  const { body } = await request(`${origin}/v3/users?limit=1&page=1`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const user = Array.isArray(body.data) ? body.data[0] : null;
  return { accountId: user?.id || region, accountName: user?.name || user?.email || `SurveySparrow ${region}`, region, verifiedUser: Boolean(user) };
}

async function yotpoToken(connection) {
  try { return await credential(connection, "access_token"); }
  catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const storeId = text(connection.metadata?.storeId, 500);
  const secret = await credential(connection, "client_secret");
  const { body } = await request("https://api.yotpo.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: storeId, client_secret: secret, grant_type: "client_credentials" }),
  });
  const token = text(body.access_token || body.utoken, 20000);
  if (!token) throw createServiceError("Yotpo did not issue a merchant uToken.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  await storeProviderCredential(connection.app, connection._id, { role: "access_token", secret: token, metadata: { refreshedBy: "yotpo_verification" } }, { businessId: connection.business });
  return token;
}

async function verifyYotpo(connection) {
  const storeId = text(connection.metadata?.storeId, 500);
  const token = await yotpoToken(connection);
  const url = new URL(`https://api.yotpo.com/apps/${encodeURIComponent(storeId)}/bottom_lines`);
  url.searchParams.set("utoken", token);
  const { body } = await request(url);
  return { accountId: storeId, accountName: `Yotpo store ${storeId}`, responseVerified: Boolean(body) };
}

function marketingCloudSubdomain(value) {
  const subdomain = text(value, 100).toLowerCase();
  if (!/^mc[a-z0-9-]{6,40}$/.test(subdomain)) throw createServiceError("Marketing Cloud tenant subdomain is invalid.", 400, { field: "subdomain" });
  return subdomain;
}

async function verifySalesforceMarketingCloud(connection) {
  const subdomain = marketingCloudSubdomain(connection.metadata?.subdomain);
  const clientId = text(connection.metadata?.clientId, 500);
  const secret = await credential(connection, "client_secret");
  const payload = { grant_type: "client_credentials", client_id: clientId, client_secret: secret };
  const accountId = text(connection.metadata?.accountId, 100);
  if (accountId) payload.account_id = accountId;
  const { body } = await request(`https://${subdomain}.auth.marketingcloudapis.com/v2/token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const token = text(body.access_token, 20000);
  const restUrl = text(body.rest_instance_url, 1000);
  if (!token || !restUrl) throw createServiceError("Marketing Cloud did not return an access token and REST instance URL.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  let rest;
  try { rest = new URL(restUrl); } catch { throw createServiceError("Marketing Cloud returned an invalid REST instance URL.", 502); }
  if (rest.protocol !== "https:" || !rest.hostname.endsWith(".rest.marketingcloudapis.com")) throw createServiceError("Marketing Cloud returned an unapproved REST instance origin.", 502, { code: "MARKETING_PROVIDER_ORIGIN_REJECTED" });
  const endpoints = await request(`${rest.origin}/platform/v1/endpoints`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 1080) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, { role: "access_token", secret: token, expiresAt, metadata: { refreshedBy: "salesforce_marketing_cloud_verification" } }, { businessId: connection.business });
  return { accountId: accountId || subdomain, accountName: `Marketing Cloud ${subdomain}`, restInstanceUrl: rest.origin, endpointContextVerified: Boolean(endpoints.body) };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE8 = Object.freeze({
  docker_hub: verifyDockerHub,
  semrush: verifySemrush,
  reply_io: verifyReply,
  survey_sparrow: verifySurveySparrow,
  yotpo: verifyYotpo,
  salesforce_marketing_cloud: verifySalesforceMarketingCloud,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE8;