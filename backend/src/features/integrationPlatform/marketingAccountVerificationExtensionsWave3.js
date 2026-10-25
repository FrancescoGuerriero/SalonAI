import dns from "node:dns/promises";
import net from "node:net";

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

function privateIp(address) {
  if (net.isIPv4(address)) {
    const octets = address.split(".").map(Number);
    return octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      octets[0] === 0;
  }
  if (net.isIPv6(address)) {
    const normalised = address.toLowerCase();
    return normalised === "::1" || normalised.startsWith("fe80:") || normalised.startsWith("fc") || normalised.startsWith("fd");
  }
  return true;
}

async function publicHttpsOrigin(value, field = "workspaceUrl") {
  let parsed;
  try { parsed = new URL(text(value, 1000)); }
  catch { throw createServiceError(`${field} must be a valid HTTPS URL.`, 400, { field }); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    throw createServiceError(`${field} must be a public HTTPS origin without embedded credentials or a custom port.`, 400, {
      field,
      code: "MARKETING_PROVIDER_ORIGIN_REJECTED",
    });
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || net.isIP(host)) {
    throw createServiceError(`${field} must not target a local or raw-IP host.`, 400, {
      field,
      code: "MARKETING_PROVIDER_ORIGIN_REJECTED",
    });
  }
  const resolved = await dns.lookup(host, { all: true, verbatim: true });
  if (!resolved.length || resolved.some((entry) => privateIp(entry.address))) {
    throw createServiceError(`${field} resolved to a private or unsafe address.`, 400, {
      field,
      code: "MARKETING_PROVIDER_ORIGIN_REJECTED",
    });
  }
  return parsed.origin;
}

function dynamicsOrigin(value) {
  let parsed;
  try { parsed = new URL(text(value, 1000)); }
  catch { throw createServiceError("Microsoft environment URL is invalid.", 400, { field: "environmentUrl" }); }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || !(host === "dynamics.com" || host.endsWith(".dynamics.com"))) {
    throw createServiceError("Microsoft environment URL must use an HTTPS dynamics.com host.", 400, {
      field: "environmentUrl",
      code: "MARKETING_PROVIDER_ORIGIN_REJECTED",
    });
  }
  return parsed.origin;
}

async function verifyQuickBooks(connection) {
  const token = await credential(connection, "access_token");
  const realmId = text(connection.metadata?.realmId, 100);
  if (!/^\d+$/.test(realmId)) throw createServiceError("QuickBooks realm ID is invalid.", 400, { field: "realmId" });
  const environment = text(connection.metadata?.environment || "production", 30).toLowerCase();
  if (!["production", "sandbox"].includes(environment)) {
    throw createServiceError("QuickBooks environment must be production or sandbox.", 400, { field: "environment" });
  }
  const origin = environment === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
  const body = await requestJson(`${origin}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const company = body.CompanyInfo || {};
  return {
    accountId: company.Id || realmId,
    accountName: company.CompanyName || company.LegalName || `QuickBooks company ${realmId}`,
    country: company.Country,
    environment,
  };
}

async function xeroAccessToken(connection) {
  try { return await credential(connection, "access_token"); }
  catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId, 500);
  const secret = await credential(connection, "client_secret");
  const refresh = await credential(connection, "refresh_token");
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const body = await requestJson("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId }).toString(),
  });
  const token = text(body.access_token, 20000);
  if (!token) throw createServiceError("Xero did not issue an access token.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 1800) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, { role: "access_token", secret: token, expiresAt, metadata: { refreshedBy: "xero_verification" } }, { businessId: connection.business });
  const rotated = text(body.refresh_token, 20000);
  if (rotated && rotated !== refresh) {
    await storeProviderCredential(connection.app, connection._id, { role: "refresh_token", secret: rotated, metadata: { refreshedBy: "xero_verification" } }, { businessId: connection.business });
  }
  return token;
}

async function verifyXero(connection) {
  const token = await xeroAccessToken(connection);
  const tenants = await requestJson("https://api.xero.com/connections", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const list = Array.isArray(tenants) ? tenants : [];
  if (!list.length) throw createServiceError("The Xero token has no authorised tenant connections.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const tenant = list[0];
  return { accountId: tenant.tenantId, accountName: tenant.tenantName, accountType: tenant.tenantType, tenantCount: list.length };
}

function zohoAccountsOrigin(value) {
  let parsed;
  try { parsed = new URL(text(value, 500)); }
  catch { throw createServiceError("Zoho Accounts domain is invalid.", 400, { field: "accountsDomain" }); }
  const allowed = new Set([
    "accounts.zoho.com", "accounts.zoho.eu", "accounts.zoho.in", "accounts.zoho.com.au",
    "accounts.zoho.com.cn", "accounts.zoho.jp", "accounts.zoho.sa", "accounts.zohocloud.ca",
  ]);
  if (parsed.protocol !== "https:" || !allowed.has(parsed.hostname.toLowerCase())) {
    throw createServiceError("Zoho Accounts domain is not an approved Zoho OAuth host.", 400, { code: "MARKETING_PROVIDER_ORIGIN_REJECTED" });
  }
  return parsed.origin;
}

function zohoApiOrigin(value) {
  let parsed;
  try { parsed = new URL(text(value, 500)); }
  catch { throw createServiceError("Zoho returned an invalid API domain.", 502); }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || !(host.includes("zohoapis.") || host === "www.zohoapis.com")) {
    throw createServiceError("Zoho returned an unapproved API domain.", 502, { code: "MARKETING_PROVIDER_ORIGIN_REJECTED" });
  }
  return parsed.origin;
}

async function zohoAccess(connection) {
  try {
    const token = await credential(connection, "access_token");
    const apiDomain = text(connection.metadata?.apiDomain, 500);
    if (apiDomain) return { token, apiOrigin: zohoApiOrigin(apiDomain) };
  } catch (error) {
    if (!["PROVIDER_CREDENTIAL_EXPIRED", "PROVIDER_CREDENTIAL_UNAVAILABLE", "PROVIDER_CREDENTIAL_NOT_BOUND"].includes(error?.code)) throw error;
  }
  const clientId = text(connection.metadata?.clientId, 500);
  const clientSecret = await credential(connection, "client_secret");
  const refresh = await credential(connection, "refresh_token");
  const accountsOrigin = zohoAccountsOrigin(connection.metadata?.accountsDomain);
  const body = await requestJson(`${accountsOrigin}/oauth/v2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ refresh_token: refresh, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }).toString(),
  });
  const token = text(body.access_token, 20000);
  const apiOrigin = zohoApiOrigin(body.api_domain);
  if (!token) throw createServiceError("Zoho did not issue an access token.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  const expiresAt = new Date(Date.now() + Math.max(60, Number(body.expires_in || 3600) - 60) * 1000);
  await storeProviderCredential(connection.app, connection._id, { role: "access_token", secret: token, expiresAt, metadata: { refreshedBy: "zoho_crm_verification" } }, { businessId: connection.business });
  connection.metadata = { ...(connection.metadata?.toObject?.() || connection.metadata || {}), apiDomain: apiOrigin };
  await connection.save();
  return { token, apiOrigin };
}

async function verifyZohoCrm(connection) {
  const { token, apiOrigin } = await zohoAccess(connection);
  const body = await requestJson(`${apiOrigin}/crm/v8/org`, {
    headers: { authorization: `Zoho-oauthtoken ${token}`, accept: "application/json" },
  });
  const org = Array.isArray(body.org) ? body.org[0] : null;
  if (!org) throw createServiceError("Zoho CRM returned no organization data.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: org.id, accountName: org.company_name || org.domain_name, accountType: org.type, currency: org.iso_code, timezone: org.time_zone };
}

async function verifyMailerSend(connection) {
  const key = await credential(connection, "api_key");
  const body = await requestJson("https://api.mailersend.com/v1/domains?limit=10", {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
  });
  const domains = Array.isArray(body.data) ? body.data : [];
  return { accountId: domains[0]?.id || "mailersend", accountName: domains[0]?.name || "MailerSend", domainCount: Number(body.meta?.total || domains.length) };
}

async function verifySurveyMonkey(connection) {
  const token = await credential(connection, "access_token");
  const body = await requestJson("https://api.surveymonkey.com/v3/users/me", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  return { accountId: body.id, accountName: body.username, displayName: `${text(body.first_name, 100)} ${text(body.last_name, 100)}`.trim(), email: body.email, accountType: body.account_type };
}

async function verifyRocketChat(connection) {
  const origin = await publicHttpsOrigin(connection.metadata?.workspaceUrl, "workspaceUrl");
  const userId = text(connection.metadata?.userId, 300);
  const token = await credential(connection, "access_token");
  const body = await requestJson(`${origin}/api/v1/me`, {
    headers: { "X-Auth-Token": token, "X-User-Id": userId, accept: "application/json" },
  });
  if (body.success !== true) throw createServiceError("Rocket.Chat did not confirm the authenticated user.", 409, { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" });
  return { accountId: body._id || userId, accountName: body.username, displayName: body.name, workspaceUrl: origin };
}

async function verifyMicrosoftTeams(connection) {
  const token = await credential(connection, "access_token");
  const body = await requestJson("https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  return { accountId: body.id, accountName: body.displayName || body.userPrincipalName, email: body.mail || body.userPrincipalName };
}

async function verifyDataverse(connection) {
  const token = await credential(connection, "access_token");
  const origin = dynamicsOrigin(connection.metadata?.environmentUrl);
  const body = await requestJson(`${origin}/api/data/v9.2/WhoAmI`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    },
  });
  return { accountId: body.OrganizationId, accountName: `Dataverse ${body.OrganizationId}`, userId: body.UserId, businessUnitId: body.BusinessUnitId };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE3 = Object.freeze({
  quickbooks: verifyQuickBooks,
  xero: verifyXero,
  zoho_crm: verifyZohoCrm,
  mailersend: verifyMailerSend,
  surveymonkey: verifySurveyMonkey,
  rocket_chat: verifyRocketChat,
  microsoft_teams: verifyMicrosoftTeams,
  microsoft_dataverse: verifyDataverse,
  microsoft_dynamics_365: verifyDataverse,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE3;