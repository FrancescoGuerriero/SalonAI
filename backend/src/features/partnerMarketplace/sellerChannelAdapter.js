/**
 * Amazon SP-API / eBay Sell read adapter.
 * Read-only, tenant-scoped and network allowlisted. Never mutates canonical
 * inventory, commerce, orders, marketplace apps or settlement records.
 */
import { createServiceError } from "../../shared/serviceError.js";
import { resolveProviderCredential } from "../integrationPlatform/providerCredentialService.js";

const AMAZON_ORIGINS = Object.freeze({
  NA: "https://sellingpartnerapi-na.amazon.com",
  EU: "https://sellingpartnerapi-eu.amazon.com",
  FE: "https://sellingpartnerapi-fe.amazon.com",
});
const EBAY_ORIGINS = Object.freeze({
  production: "https://api.ebay.com",
  sandbox: "https://api.sandbox.ebay.com",
});
const MAX_RESULTS = 50;
const NETWORK_TIMEOUT_MS = 12000;
const unsupported = (message, code = "SELLER_CHANNEL_NOT_CONFIGURED") =>
  createServiceError(message, 409, { code });

function required(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 300) {
    throw unsupported(`Seller channel ${name} is not configured.`);
  }
  return value.trim();
}
function integer(value, fallback = 25) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_RESULTS) : fallback;
}
async function fetchJson(fetchImpl, url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const result = await fetchImpl(url, { ...init, redirect: "error", signal: controller.signal });
    if (!result.ok) {
      // Do not echo provider error bodies; these may contain personal data or tokens.
      throw createServiceError(`Seller provider returned HTTP ${result.status}.`, result.status === 429 ? 429 : 502, {
        code: "SELLER_CHANNEL_PROVIDER_ERROR", providerStatus: result.status,
      });
    }
    const body = await result.json();
    if (!body || typeof body !== "object") throw unsupported("Unexpected seller API response.", "SELLER_CHANNEL_BAD_RESPONSE");
    return body;
  } catch (error) {
    if (error?.name === "AbortError") throw createServiceError("Seller provider timed out.", 504, {
      code: "SELLER_CHANNEL_TIMEOUT",
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function secret(connection, role, getCredential) {
  return required((await getCredential(connection, role)).secret, role);
}
async function amazonToken(connection, fetchImpl, getCredential) {
  const clientId = required(connection.metadata?.clientId, "clientId");
  const clientSecret = await secret(connection, "client_secret", getCredential);
  const refreshToken = await secret(connection, "refresh_token", getCredential);
  const token = await fetchJson(fetchImpl, "https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", client_id: clientId,
      client_secret: clientSecret, refresh_token: refreshToken,
    }).toString(),
  });
  return required(token.access_token, "accessToken");
}
async function ebayToken(connection, fetchImpl, getCredential) {
  const clientId = required(connection.metadata?.clientId, "clientId");
  const clientSecret = await secret(connection, "client_secret", getCredential);
  const refreshToken = await secret(connection, "refresh_token", getCredential);
  const env = connection.metadata?.environment || "production";
  const origin = EBAY_ORIGINS[env];
  if (!origin) throw unsupported("Unsupported eBay environment.");
  const token = await fetchJson(fetchImpl, `${origin}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
  });
  return { token: required(token.access_token, "accessToken"), origin };
}
function amazonConfig(connection) {
  const region = connection.metadata?.region || "EU";
  const origin = AMAZON_ORIGINS[region];
  if (!origin) throw unsupported("Unsupported Amazon SP-API region.");
  const sellerId = required(connection.metadata?.sellerId, "sellerId");
  const marketplaceId = required(connection.metadata?.marketplaceId, "marketplaceId");
  return { origin, sellerId, marketplaceId };
}
function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function safeOrder(order, provider) {
  if (provider === "amazon") return {
    provider, externalOrderId: String(order.orderId || ""),
    status: String(order.fulfillment?.fulfillmentStatus || ""),
    placedAt: safeDate(order.createdTime),
    total: order.proceeds?.grandTotal?.amount ?? null,
    currency: order.proceeds?.grandTotal?.currencyCode ?? null,
    fulfillmentStatus: order.fulfillment?.fulfillmentStatus || null,
  };
  return {
    provider, externalOrderId: String(order.orderId || ""),
    status: String(order.orderFulfillmentStatus || ""),
    placedAt: safeDate(order.creationDate),
    total: order.pricingSummary?.total?.value ?? null,
    currency: order.pricingSummary?.total?.currency ?? null,
    fulfillmentStatus: order.orderFulfillmentStatus || null,
  };
}
function safeListing(item, provider) {
  if (provider === "amazon") return {
    provider, sku: String(item.sku || ""), externalListingId: item.asin || null,
    status: Array.isArray(item.summaries) ? item.summaries[0]?.status || null : null,
    quantity: null, // SP-API listings do not always expose sellable quantity.
  };
  return {
    provider, sku: String(item.sku || ""), externalListingId: null,
    status: null, quantity: item.availability?.shipToLocationAvailability?.quantity ?? null,
  };
}
export async function fetchSellerChannelSnapshot(connection, kind, {
  fetchImpl = fetch, getCredential = resolveProviderCredential, limit = 25,
} = {}) {
  const provider = String(connection?.provider || "").toLowerCase();
  if (!["amazon_seller_central", "ebay"].includes(provider)) {
    throw unsupported("Connection is not an Amazon Seller Central or eBay seller channel.");
  }
  if (!["listings", "orders", "fulfillments"].includes(kind)) {
    throw unsupported("Unsupported read-only seller operation.");
  }
  const take = integer(limit);
  let url;
  let headers;
  if (provider === "amazon_seller_central") {
    const config = amazonConfig(connection);
    if (kind === "fulfillments") {
      throw unsupported("Amazon fulfillment needs a separately authorised fulfillment API scope.",
        "SELLER_CHANNEL_SCOPE_NOT_IMPLEMENTED");
    }
    const accessToken = await amazonToken(connection, fetchImpl, getCredential);
    headers = { "x-amz-access-token": accessToken, accept: "application/json" };
    url = new URL(kind === "listings"
      ? `/listings/2021-08-01/items/${encodeURIComponent(config.sellerId)}`
      : "/orders/2026-01-01/orders", config.origin);
    if (kind === "listings") {
      url.searchParams.set("marketplaceIds", config.marketplaceId);
      url.searchParams.set("pageSize", String(Math.min(take, 20)));
    } else {
      url.searchParams.set("marketplaceIds", config.marketplaceId);
      url.searchParams.set("createdAfter", new Date(Date.now() - 7 * 86400000).toISOString());
      url.searchParams.set("maxResultsPerPage", String(take));
      url.searchParams.set("includedData", "PROCEEDS");
    }
  } else {
    const ebay = await ebayToken(connection, fetchImpl, getCredential);
    headers = { authorization: `Bearer ${ebay.token}`, accept: "application/json" };
    url = new URL(kind === "listings"
      ? "/sell/inventory/v1/inventory_item"
      : "/sell/fulfillment/v1/order", ebay.origin);
    url.searchParams.set("limit", String(take));
    url.searchParams.set("offset", "0");
  }
  const response = await fetchJson(fetchImpl, url.toString(), { method: "GET", headers });
  const items = provider === "amazon_seller_central"
    ? kind === "listings" ? response.items : response.orders
    : kind === "listings" ? response.inventoryItems : response.orders;
  if (!Array.isArray(items)) throw unsupported("Unexpected seller result shape.", "SELLER_CHANNEL_BAD_RESPONSE");
  // No buyer information, addresses, payment identifiers or provider access tokens.
  const normalized = items.slice(0, take).map((item) =>
    kind === "listings" ? safeListing(item, provider === "amazon_seller_central" ? "amazon" : "ebay")
      : safeOrder(item, provider === "amazon_seller_central" ? "amazon" : "ebay"));
  return Object.freeze({
    provider, kind, source: "read_only_provider_snapshot", records: normalized,
    recordCount: normalized.length, nextPageAvailable: Boolean(
      response.pagination?.nextToken || response.next),
    canonicalRecordsWritten: 0, ordersFulfilled: 0, returnsProcessed: 0,
    publicationEnabled: false,
  });
}

/**
 * eBay shipping labels / package status are read separately from order lists.
 * No carrier booking, shipment creation, refund or tracking mutation is made.
 */
export async function fetchEbayShippingFulfillments(connection, orderId, {
  fetchImpl = fetch, getCredential = resolveProviderCredential,
} = {}) {
  if (connection?.provider !== "ebay") {
    throw unsupported("Shipping fulfillment detail requires an eBay seller connection.");
  }
  const identifier = required(orderId, "orderId");
  if (identifier.length > 120 || !/^[a-zA-Z0-9!_.-]+$/.test(identifier)) {
    throw unsupported("Invalid eBay order identifier.", "SELLER_CHANNEL_INVALID_ORDER_ID");
  }
  const { token, origin } = await ebayToken(connection, fetchImpl, getCredential);
  const url = new URL(`/sell/fulfillment/v1/order/${encodeURIComponent(identifier)}/shipping_fulfillment`, origin);
  const body = await fetchJson(fetchImpl, url.toString(), {
    method: "GET", headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!Array.isArray(body.fulfillments)) {
    throw unsupported("Unexpected eBay shipping fulfillment response.", "SELLER_CHANNEL_BAD_RESPONSE");
  }
  return Object.freeze({
    provider: "ebay", kind: "shipping_fulfillments", source: "read_only_provider_snapshot",
    externalOrderId: identifier,
    records: body.fulfillments.slice(0, 50).map((item) => ({
      fulfillmentId: String(item.fulfillmentId || ""),
      shippedDate: safeDate(item.shippedDate),
      carrierCode: item.shippingCarrierCode || null,
      trackingNumber: item.shipmentTrackingNumber || null,
    })),
    canonicalRecordsWritten: 0, shippingUpdatesPosted: 0, refundsProcessed: 0,
  });
}
