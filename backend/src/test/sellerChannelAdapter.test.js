import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fetchEbayShippingFulfillments, fetchSellerChannelSnapshot } from "../features/partnerMarketplace/sellerChannelAdapter.js";

const AMAZON = {
  provider: "amazon_seller_central",
  metadata: { clientId: "client-amazon", sellerId: "SELLER123", marketplaceId: "A1F83G8C2ARO7P", region: "EU" },
};
const EBAY = { provider: "ebay", metadata: { clientId: "client-ebay", environment: "sandbox" } };
const getCredential = async (_connection, role) => ({
  secret: { client_secret: "supersecret", refresh_token: "refresh" }[role],
});
function fakeResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function fetchFixture(responses, captured = []) {
  return async (url, options) => {
    captured.push({ url: String(url), options });
    const body = responses.shift();
    assert.ok(body, `Unexpected outbound request ${url}`);
    return fakeResponse(body);
  };
}

test("Amazon seller listings use allowlisted SP-API origin and sanitize raw provider data", async () => {
  const calls = [];
  const result = await fetchSellerChannelSnapshot(AMAZON, "listings", {
    getCredential, fetchImpl: fetchFixture([
      { access_token: "short-lived" },
      { items: [{ sku: "AB-01", asin: "B001", summaries: [{ status: ["BUYABLE"] }],
        attributes: { buyerEmail: "must-not-leak" } }] },
    ], calls),
  });
  assert.equal(result.recordCount, 1);
  assert.equal(result.records[0].sku, "AB-01");
  assert.ok(!JSON.stringify(result).includes("must-not-leak"));
  assert.equal(result.canonicalRecordsWritten, 0);
  assert.equal(result.publicationEnabled, false);
  assert.ok(calls[0].url === "https://api.amazon.com/auth/o2/token");
  assert.ok(calls[1].url.startsWith("https://sellingpartnerapi-eu.amazon.com/listings/2021-08-01/items/SELLER123?"));
  assert.equal(calls[1].options.headers["x-amz-access-token"], "short-lived");
  assert.equal(calls[1].options.redirect, "error");
});

test("Amazon orders normalize dates and totals without buyer identities", async () => {
  const result = await fetchSellerChannelSnapshot(AMAZON, "orders", {
    getCredential, fetchImpl: fetchFixture([
      { access_token: "short-lived" },
      { orders: [{ orderId: "111-222", fulfillment: { fulfillmentStatus: "SHIPPED" },
        createdTime: "2026-10-01T11:00:00Z", proceeds: { grandTotal: { amount: "10.00", currencyCode: "GBP" } },
        buyer: { email: "private@example.com" } }] },
    ]),
  });
  assert.equal(result.records[0].externalOrderId, "111-222");
  assert.equal(result.records[0].status, "SHIPPED");
  assert.equal(result.records[0].total, "10.00");
  assert.ok(!JSON.stringify(result).includes("private@example.com"));
  assert.equal(result.ordersFulfilled, 0);
});

test("eBay seller inventory and fulfilment status require OAuth refresh and never expose buyer addresses", async () => {
  const calls = [];
  const inventory = await fetchSellerChannelSnapshot(EBAY, "listings", {
    getCredential, fetchImpl: fetchFixture([
      { access_token: "ebay-token" },
      { inventoryItems: [{ sku: "SKU-2", availability: { shipToLocationAvailability: { quantity: 7 } } }] },
    ], calls),
  });
  assert.equal(inventory.records[0].quantity, 7);
  assert.equal(calls[0].url, "https://api.sandbox.ebay.com/identity/v1/oauth2/token");
  assert.ok(calls[0].options.headers.authorization.startsWith("Basic "));
  assert.ok(calls[1].url.startsWith("https://api.sandbox.ebay.com/sell/inventory/v1/inventory_item?"));
  const orders = await fetchSellerChannelSnapshot(EBAY, "fulfillments", {
    getCredential, fetchImpl: fetchFixture([
      { access_token: "ebay-token" },
      { orders: [{ orderId: "EB-001", orderFulfillmentStatus: "FULFILLED",
        pricingSummary: { total: { value: "45", currency: "GBP" } },
        buyer: { username: "redacted" },
        fulfillmentStartInstructions: [{ shippingStep: { shipTo: { address: "redacted" } } }] }] },
    ]),
  });
  assert.equal(orders.records[0].fulfillmentStatus, "FULFILLED");
  assert.ok(!JSON.stringify(orders).includes("redacted"));
  assert.equal(orders.canonicalRecordsWritten, 0);
});

test("seller channel fails closed on unknown provider, Amazon region, operation and no Amazon fulfillment scope", async () => {
  const calls = [];
  const fetchImpl = async () => { calls.push(true); throw new Error("Unexpected network call"); };
  for (const [connection, kind] of [
    [{ provider: "untrusted" }, "orders"],
    [{ ...AMAZON, metadata: { ...AMAZON.metadata, region: "https://evil.test" } }, "listings"],
    [AMAZON, "publish"],
    [AMAZON, "fulfillments"],
  ]) {
    await assert.rejects(fetchSellerChannelSnapshot(connection, kind, { fetchImpl, getCredential }));
  }
  assert.equal(calls.length, 0);
});

test("seller channel routes keep trusted tenant ownership and permission boundary", async () => {
  const [routes, integration, adapter] = await Promise.all([
    readFile(new URL("../features/partnerMarketplace/sellerChannelRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../features/integrationPlatform/integrationPlatformRoutes.js", import.meta.url), "utf8"),
    readFile(new URL("../features/partnerMarketplace/sellerChannelAdapter.js", import.meta.url), "utf8"),
  ]);
  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /business: businessId/);
  assert.match(routes, /status: "connected"/);
  assert.match(routes, /"inventory:read"/);
  assert.match(routes, /"order:read"/);
  assert.match(integration, /sellerChannelRoutes/);
  assert.match(integration, /"\/seller-channels"/);
  assert.doesNotMatch(routes, /\.create\(|\.updateOne\(|\.findOneAndUpdate\(/);
  assert.doesNotMatch(adapter, /MarketplaceInstallation\.create|IntegrationConnection\.create/);
});

test("eBay shipping fulfilment detail reads packages without posting shipments", async () => {
  const calls = [];
  const result = await fetchEbayShippingFulfillments(EBAY, "EB-01!123", {
    getCredential, fetchImpl: fetchFixture([
      { access_token: "ebay-token" },
      { fulfillments: [{
        fulfillmentId: "FULF-1", shippingCarrierCode: "UPS",
        shipmentTrackingNumber: "TRACK-1", shippedDate: "2026-11-01T11:00:00Z",
        destinationAddress: { recipient: "private" },
      }] },
    ], calls),
  });
  assert.equal(result.records[0].carrierCode, "UPS");
  assert.equal(result.records[0].trackingNumber, "TRACK-1");
  assert.equal(result.shippingUpdatesPosted, 0);
  assert.ok(!JSON.stringify(result).includes("private"));
  assert.ok(calls[1].url.includes("/sell/fulfillment/v1/order/EB-01!123/shipping_fulfillment"));
  assert.equal(calls[1].options.method, "GET");
  await assert.rejects(fetchEbayShippingFulfillments(AMAZON, "x", {
    getCredential, fetchImpl: () => { throw new Error("Unexpected call"); },
  }));
});
