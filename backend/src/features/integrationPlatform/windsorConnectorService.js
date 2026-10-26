import { createHash } from "node:crypto";

import { createServiceError } from "../../shared/serviceError.js";
import {
  listWindsorMarketingConnectors,
  windsorMarketingConnector,
} from "./windsorConnectorCatalogue.js";

const CONNECTORS_BASE = "https://connectors.windsor.ai";
const ONBOARD_BASE = "https://onboard.windsor.ai";
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_PREVIEW_ROWS = 100;

function configuredKey() {
  return String(process.env.WINDSOR_API_KEY || "").trim();
}

function apiKey() {
  const value = configuredKey();
  if (!value) {
    throw createServiceError(
      "Windsor integration is not configured for this environment.",
      503,
      { code: "WINDSOR_NOT_CONFIGURED" }
    );
  }
  return value;
}

function safeText(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function safeIsoDate(value, field) {
  const text = safeText(value, 10);
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createServiceError(`${field} must use YYYY-MM-DD format.`, 400, { field });
  }
  return text;
}

function hash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

async function requestJson(url, { method = "GET", signal, body = null } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const linkedSignal = signal || controller.signal;
  try {
    const response = await fetch(url, {
      method,
      signal: linkedSignal,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text.slice(0, 1000) };
    }
    if (!response.ok) {
      throw createServiceError(
        payload?.error || payload?.message || `Windsor request failed with status ${response.status}.`,
        response.status >= 500 ? 502 : 400,
        { code: "WINDSOR_UPSTREAM_ERROR", upstreamStatus: response.status }
      );
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function connectorCandidates(entry) {
  return [...new Set([entry.key, ...(entry.aliases || [])])];
}

function flattenConnectorIds(payload) {
  const values = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.connectors)
      ? payload.connectors
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
  const ids = new Set();
  for (const item of values) {
    if (typeof item === "string") ids.add(item.trim().toLowerCase());
    else if (item && typeof item === "object") {
      for (const candidate of [item.id, item.key, item.connector, item.datasource, item.name]) {
        if (candidate) ids.add(String(candidate).trim().toLowerCase());
      }
    }
  }
  return ids;
}

function offlineAvailability() {
  return listWindsorMarketingConnectors().map((entry) => ({
    ...entry,
    resolvedConnectorId: entry.key,
    available: null,
    discoveryAvailable: false,
  }));
}

export async function listWindsorConnectorAvailability() {
  if (!configuredKey()) return offlineAvailability();

  let liveIds = new Set();
  let discoveryAvailable = false;
  try {
    const url = new URL(`${CONNECTORS_BASE}/list_connectors`);
    url.searchParams.set("api_key", apiKey());
    const payload = await requestJson(url);
    liveIds = flattenConnectorIds(payload);
    discoveryAvailable = liveIds.size > 0;
  } catch {
    return offlineAvailability();
  }

  return listWindsorMarketingConnectors().map((entry) => {
    const resolvedConnectorId = discoveryAvailable
      ? connectorCandidates(entry).find((candidate) => liveIds.has(candidate)) || ""
      : entry.key;
    return {
      ...entry,
      resolvedConnectorId,
      available: discoveryAvailable ? Boolean(resolvedConnectorId) : null,
      discoveryAvailable,
    };
  });
}

export async function getWindsorConnectInfo(productKey) {
  const entry = windsorMarketingConnector(productKey);
  if (!entry) {
    throw createServiceError("Unknown Windsor Marketing connector.", 404, {
      code: "WINDSOR_CONNECTOR_NOT_IN_PRODUCT_CATALOGUE",
    });
  }
  if (["destination", "ai-destination"].includes(entry.kind)) {
    throw createServiceError(
      `${entry.label} is a destination, not a Marketing data source.`,
      409,
      { code: "WINDSOR_CONNECTOR_IS_DESTINATION" }
    );
  }

  const availability = await listWindsorConnectorAvailability();
  const live = availability.find((candidate) => candidate.key === entry.key);
  if (live?.available === false) {
    throw createServiceError(`${entry.label} is not currently exposed by the configured Windsor connector catalogue.`, 409, {
      code: "WINDSOR_CONNECTOR_NOT_AVAILABLE",
    });
  }
  const connectorId = live?.resolvedConnectorId || entry.key;
  const url = new URL(`${ONBOARD_BASE}/api/mcp/connectors/${encodeURIComponent(connectorId)}/connect-info`);
  url.searchParams.set("api_key", apiKey());
  const payload = await requestJson(url);

  return {
    productKey: entry.key,
    connectorId,
    label: entry.label,
    category: entry.category,
    kind: entry.kind,
    authType: safeText(payload?.auth_type, 30),
    connectUrl: safeText(payload?.connect_url, 4000),
    fields: Array.isArray(payload?.fields)
      ? payload.fields.map((field) => ({
          name: safeText(field?.name, 100),
          type: safeText(field?.type, 30) || "string",
          required: Boolean(field?.required),
          sensitive: Boolean(field?.sensitive),
        }))
      : [],
  };
}

export async function generateWindsorAuthorization(productKey) {
  const info = await getWindsorConnectInfo(productKey);
  const url = new URL(`${ONBOARD_BASE}/api/team/generate-co-user-url/`);
  url.searchParams.set("allowed_sources", info.connectorId);
  url.searchParams.set("api_key", apiKey());
  const payload = await requestJson(url);
  const authorizationUrl = safeText(
    payload?.url || payload?.connect_url || payload?.authorization_url || payload?.result,
    4000
  );
  if (!authorizationUrl) {
    throw createServiceError("Windsor did not return an authorization URL.", 502, {
      code: "WINDSOR_AUTHORIZATION_URL_MISSING",
    });
  }

  const parsed = new URL(authorizationUrl);
  const accessToken = safeText(
    payload?.access_token || payload?.accessToken || parsed.searchParams.get("access_token"),
    4000
  );
  if (!accessToken) {
    throw createServiceError("Windsor authorization link did not expose a session token for tenant-safe reconciliation.", 502, {
      code: "WINDSOR_AUTHORIZATION_SESSION_MISSING",
    });
  }

  return {
    ...info,
    authorizationUrl,
    authorizationSessionHash: hash(accessToken),
    authorizationAccessToken: accessToken,
  };
}

export async function listWindsorLinkedAccounts({ connectorId = "", accessToken = "" } = {}) {
  if (!accessToken) {
    throw createServiceError("A Windsor authorization-session token is required for tenant-scoped reconciliation.", 409, {
      code: "WINDSOR_AUTHORIZATION_SESSION_REQUIRED",
    });
  }
  const url = new URL(`${ONBOARD_BASE}/api/team/co-user-linked-accounts/`);
  url.searchParams.set("api_key", apiKey());
  if (connectorId) url.searchParams.set("ds_id", connectorId);
  url.searchParams.set("access_token", accessToken);
  const payload = await requestJson(url);
  const values = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.accounts)
      ? payload.accounts
      : Array.isArray(payload?.results)
        ? payload.results
        : [];
  return values.map((account) => ({
    datasource: safeText(account?.datasource || account?.ds_id, 100).toLowerCase(),
    accountId: safeText(account?.account_id || account?.accountId, 300),
    accountName: safeText(account?.account_name || account?.accountName || account?.name, 300),
  })).filter((account) => account.datasource && account.accountId);
}

export async function unlinkWindsorLinkedAccount({ connectorId, accountId, accessToken = "" }) {
  if (!accessToken) {
    throw createServiceError("A Windsor authorization-session token is required for tenant-scoped unlink.", 409, {
      code: "WINDSOR_AUTHORIZATION_SESSION_REQUIRED",
    });
  }
  const url = new URL(`${ONBOARD_BASE}/api/team/co-user-linked-accounts/`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("ds_id", safeText(connectorId, 100));
  url.searchParams.set("account_id", safeText(accountId, 300));
  url.searchParams.set("access_token", accessToken);
  return requestJson(url, { method: "DELETE" });
}

export async function getWindsorConnectorFields(connectorId) {
  const id = safeText(connectorId, 100).toLowerCase();
  if (!id) throw createServiceError("Windsor connector id is required.", 400);
  const url = new URL(`${CONNECTORS_BASE}/${encodeURIComponent(id)}/fields`);
  url.searchParams.set("api_key", apiKey());
  return requestJson(url);
}

export async function getWindsorConnectorOptions(connectorId) {
  const id = safeText(connectorId, 100).toLowerCase();
  if (!id) throw createServiceError("Windsor connector id is required.", 400);
  const url = new URL(`${CONNECTORS_BASE}/${encodeURIComponent(id)}/options`);
  url.searchParams.set("api_key", apiKey());
  return requestJson(url);
}

export async function previewWindsorData({
  connectorId,
  accountId,
  fields = [],
  datePreset = "last_7d",
  dateFrom = "",
  dateTo = "",
  limit = 25,
  refreshSince = "",
  refreshInterval = "",
}) {
  const id = safeText(connectorId, 100).toLowerCase();
  const account = safeText(accountId, 300);
  const selected = [...new Set((Array.isArray(fields) ? fields : []).map((value) => safeText(value, 120)).filter(Boolean))].slice(0, 50);
  if (!id || !account) throw createServiceError("Connector and account are required for Windsor preview.", 400);
  if (selected.length === 0) {
    selected.push("date", "account_id", "account_name");
  } else {
    if (!selected.includes("account_id")) selected.push("account_id");
    if (!selected.includes("account_name")) selected.push("account_name");
  }

  const from = safeIsoDate(dateFrom, "dateFrom");
  const to = safeIsoDate(dateTo, "dateTo");
  const url = new URL(`${CONNECTORS_BASE}/${encodeURIComponent(id)}`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("fields", selected.join(","));
  url.searchParams.set("select_accounts", account);
  url.searchParams.set("_max_rows", String(Math.max(1, Math.min(Number(limit) || 25, MAX_PREVIEW_ROWS))));
  if (from) {
    url.searchParams.set("date_from", from);
    if (to) url.searchParams.set("date_to", to);
  } else {
    url.searchParams.set("date_preset", safeText(datePreset, 50) || "last_7d");
  }
  if (refreshSince) url.searchParams.set("refresh_since", safeText(refreshSince, 20));
  if (refreshInterval) url.searchParams.set("refresh_interval", safeText(refreshInterval, 20));
  return requestJson(url);
}

export function windsorConnectorRuntimeConfig() {
  return Object.freeze({
    configured: Boolean(configuredKey()),
    readOnlyByDefault: true,
    maxPreviewRows: MAX_PREVIEW_ROWS,
    documentedApiRateLimits: Object.freeze({ requestsPerMinute: 600, requestsPerDay: 10000 }),
  });
}

export default {
  generateWindsorAuthorization,
  getWindsorConnectInfo,
  getWindsorConnectorFields,
  getWindsorConnectorOptions,
  listWindsorConnectorAvailability,
  listWindsorLinkedAccounts,
  previewWindsorData,
  unlinkWindsorLinkedAccount,
  windsorConnectorRuntimeConfig,
};
