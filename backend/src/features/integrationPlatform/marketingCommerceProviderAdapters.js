import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import { resolveProviderCredential } from "./providerCredentialService.js";

export const SHOPIFY_ADMIN_API_VERSION = "2026-10";
export const STRIPE_CHARGES_ENDPOINT = "https://api.stripe.com/v1/charges";

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const MAX_PROVIDER_RECORDS = 100000;
const SHOPIFY_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);
const THREE_DECIMAL_CURRENCIES = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

function text(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function finiteNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function positiveInteger(value, fallback, min = 1, max = MAX_PROVIDER_RECORDS) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

function dateOnly(value, fallback) {
  const date = value ? new Date(value) : fallback;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw createServiceError("Marketing provider date window is invalid.", 400);
  }
  return date.toISOString().slice(0, 10);
}

function defaultWindow(source, payload = {}) {
  const today = new Date();
  const fallbackStart = new Date(today.getTime() - 28 * 86400000);
  const checkpoint = source.checkpoint?.watermark || null;
  return {
    startDate: dateOnly(payload.start || checkpoint, fallbackStart),
    endDate: dateOnly(payload.end, today),
  };
}

function retryAfterMs(response, attempt) {
  const raw = response?.headers?.get?.("retry-after") || "";
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(60000, seconds * 1000);
  return Math.min(30000, 1000 * (2 ** attempt));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options = {}, { retries = MAX_RETRIES } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const raw = await response.text();
      let body = {};
      if (raw) {
        try { body = JSON.parse(raw); }
        catch { body = { raw: text(raw, 2000) }; }
      }
      if (response.ok) return { response, body };
      const retryable = response.status === 429 || response.status >= 500;
      const error = createServiceError(`Marketing provider request failed with HTTP ${response.status}.`, response.status, {
        code: "MARKETING_PROVIDER_HTTP_ERROR",
        providerStatus: response.status,
        providerBody: body,
      });
      if (!retryable || attempt >= retries) throw error;
      lastError = error;
      await delay(retryAfterMs(response, attempt));
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = createServiceError("Marketing provider request timed out.", 504, { code: "MARKETING_PROVIDER_TIMEOUT" });
      } else {
        lastError = error;
      }
      if (attempt >= retries || (lastError?.statusCode && lastError.statusCode < 500 && lastError.statusCode !== 429)) throw lastError;
      await delay(Math.min(30000, 1000 * (2 ** attempt)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || createServiceError("Marketing provider request failed.", 502);
}

async function connectionForSource(source) {
  if (!source.connection) {
    throw createServiceError("Live provider retrieval requires an IntegrationConnection.", 409, {
      code: "MARKETING_PROVIDER_CONNECTION_REQUIRED",
    });
  }
  const connection = await IntegrationConnection.findOne({
    _id: source.connection,
    business: source.business,
    app: source.app,
  });
  if (!connection || !["connected", "degraded"].includes(connection.status)) {
    throw createServiceError("Marketing provider connection is not connected.", 409, {
      code: "MARKETING_PROVIDER_CONNECTION_NOT_READY",
    });
  }
  return connection;
}

function moneyAmount(value) {
  return finiteNumber(value?.shopMoney?.amount ?? value?.amount ?? 0);
}

export function normaliseShopifyOrder(order = {}) {
  const created = new Date(order.createdAt || 0);
  const date = Number.isNaN(created.getTime()) ? "" : created.toISOString().slice(0, 10);
  return {
    date,
    orderId: text(order.id, 500),
    channel: text(order.sourceName || "shopify", 160),
    orders: 1,
    revenue: moneyAmount(order.totalReceivedSet),
    refunds: moneyAmount(order.totalRefundedSet),
  };
}

function shopifyEndpoint(shopDomain) {
  const domain = text(shopDomain, 300).toLowerCase();
  if (!SHOPIFY_DOMAIN_PATTERN.test(domain)) {
    throw createServiceError("Shopify shopDomain must be a valid *.myshopify.com domain.", 422, {
      code: "SHOPIFY_DOMAIN_INVALID",
    });
  }
  return `https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
}

async function fetchShopify(source, payload = {}) {
  const connection = await connectionForSource(source);
  const token = (await resolveProviderCredential(connection, "access_token")).secret;
  const endpoint = shopifyEndpoint(source.sourceConfig?.shopDomain);
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const query = `query DataHubOrders($first: Int!, $after: String, $filter: String!) {
    orders(first: $first, after: $after, query: $filter, sortKey: CREATED_AT) {
      edges {
        cursor
        node {
          id
          createdAt
          sourceName
          totalReceivedSet { shopMoney { amount currencyCode } }
          totalRefundedSet { shopMoney { amount currencyCode } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const records = [];
  let cursor = null;
  let pageCount = 0;
  while (records.length < maxRecords && pageCount < 500) {
    const { body } = await requestJson(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-access-token": token,
      },
      body: JSON.stringify({
        query,
        variables: {
          first: Math.min(100, maxRecords - records.length),
          after: cursor,
          filter: `created_at:>=${startDate} created_at:<=${endDate}`,
        },
      }),
    });
    if (Array.isArray(body.errors) && body.errors.length) {
      throw createServiceError("Shopify GraphQL returned errors.", 502, {
        code: "SHOPIFY_GRAPHQL_ERROR",
        providerErrors: body.errors.slice(0, 10),
      });
    }
    const connectionData = body.data?.orders;
    const edges = Array.isArray(connectionData?.edges) ? connectionData.edges : [];
    for (const edge of edges) {
      records.push(normaliseShopifyOrder(edge?.node || {}));
      if (records.length >= maxRecords) break;
    }
    pageCount += 1;
    if (!connectionData?.pageInfo?.hasNextPage || !connectionData?.pageInfo?.endCursor || !edges.length) break;
    cursor = text(connectionData.pageInfo.endCursor, 2000);
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`), cursor: cursor || "" },
    providerMeta: { shopDomain: new URL(endpoint).hostname, startDate, endDate, rowCount: records.length, pages: pageCount, apiVersion: SHOPIFY_ADMIN_API_VERSION },
  };
}

function stripeCurrencyDivisor(currency) {
  const code = text(currency, 10).toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1000;
  return 100;
}

export function normaliseStripeCharge(charge = {}) {
  const created = new Date(finiteNumber(charge.created) * 1000);
  const divisor = stripeCurrencyDivisor(charge.currency);
  const succeeded = charge.status === "succeeded" && charge.paid !== false;
  return {
    date: Number.isNaN(created.getTime()) ? "" : created.toISOString().slice(0, 10),
    paymentId: text(charge.id, 500),
    currency: text(charge.currency, 10).toLowerCase(),
    payments: succeeded ? 1 : 0,
    revenue: succeeded ? finiteNumber(charge.amount_captured ?? charge.amount) / divisor : 0,
    refunds: finiteNumber(charge.amount_refunded) / divisor,
  };
}

async function fetchStripe(source, payload = {}) {
  const connection = await connectionForSource(source);
  const key = (await resolveProviderCredential(connection, "api_key")).secret;
  const { startDate, endDate } = defaultWindow(source, payload);
  const maxRecords = positiveInteger(source.sourceConfig?.maxRecords, 50000);
  const startSeconds = Math.floor(new Date(`${startDate}T00:00:00.000Z`).getTime() / 1000);
  const endSeconds = Math.floor(new Date(`${endDate}T23:59:59.999Z`).getTime() / 1000);
  const headers = {
    authorization: `Basic ${Buffer.from(`${key}:`, "utf8").toString("base64")}`,
  };
  const connectedAccount = text(source.sourceConfig?.accountId, 300);
  if (connectedAccount) headers["stripe-account"] = connectedAccount;
  const records = [];
  let startingAfter = "";
  let pageCount = 0;
  while (records.length < maxRecords && pageCount < 1000) {
    const url = new URL(STRIPE_CHARGES_ENDPOINT);
    url.searchParams.set("limit", String(Math.min(100, maxRecords - records.length)));
    url.searchParams.set("created[gte]", String(startSeconds));
    url.searchParams.set("created[lte]", String(endSeconds));
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);
    const { body } = await requestJson(url.toString(), { method: "GET", headers });
    const data = Array.isArray(body.data) ? body.data : [];
    for (const charge of data) {
      records.push(normaliseStripeCharge(charge));
      if (records.length >= maxRecords) break;
    }
    pageCount += 1;
    if (!body.has_more || !data.length) break;
    startingAfter = text(data[data.length - 1]?.id, 500);
    if (!startingAfter) break;
  }
  return {
    records,
    checkpoint: { watermark: new Date(`${endDate}T23:59:59.999Z`), cursor: startingAfter },
    providerMeta: { accountId: connectedAccount || null, startDate, endDate, rowCount: records.length, pages: pageCount },
  };
}

export async function fetchMarketingCommerceProviderRecords(source, payload = {}) {
  switch (source.provider) {
    case "shopify": return fetchShopify(source, payload);
    case "stripe": return fetchStripe(source, payload);
    default:
      throw createServiceError(`Commerce provider executor is not available for: ${source.provider}.`, 409, {
        code: "MARKETING_COMMERCE_PROVIDER_EXECUTOR_NOT_AVAILABLE",
      });
  }
}

export default {
  SHOPIFY_ADMIN_API_VERSION,
  STRIPE_CHARGES_ENDPOINT,
  fetchMarketingCommerceProviderRecords,
  normaliseShopifyOrder,
  normaliseStripeCharge,
};
