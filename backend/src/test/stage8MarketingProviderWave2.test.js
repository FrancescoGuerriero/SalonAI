import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SHOPIFY_ADMIN_API_VERSION,
  STRIPE_CHARGES_ENDPOINT,
  normaliseShopifyOrder,
  normaliseStripeCharge,
} from "../features/integrationPlatform/marketingCommerceProviderAdapters.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Shopify orders normalise gross revenue and refunds into canonical commerce facts", () => {
  const record = normaliseShopifyOrder({
    id: "gid://shopify/Order/123",
    createdAt: "2026-10-20T11:30:00Z",
    sourceName: "web",
    totalReceivedSet: { shopMoney: { amount: "125.50", currencyCode: "GBP" } },
    totalRefundedSet: { shopMoney: { amount: "15.25", currencyCode: "GBP" } },
  });
  assert.deepEqual(record, {
    date: "2026-10-20",
    orderId: "gid://shopify/Order/123",
    channel: "web",
    orders: 1,
    revenue: 125.5,
    refunds: 15.25,
  });
  assert.equal(SHOPIFY_ADMIN_API_VERSION, "2026-10");
});

test("Stripe charges normalise captured revenue, refunds and currency units", () => {
  const gbp = normaliseStripeCharge({
    id: "ch_gbp",
    created: 1792495800,
    currency: "gbp",
    status: "succeeded",
    paid: true,
    amount_captured: 12550,
    amount_refunded: 1525,
  });
  assert.equal(gbp.payments, 1);
  assert.equal(gbp.revenue, 125.5);
  assert.equal(gbp.refunds, 15.25);

  const jpy = normaliseStripeCharge({
    id: "ch_jpy",
    created: 1792495800,
    currency: "jpy",
    status: "succeeded",
    paid: true,
    amount_captured: 5000,
    amount_refunded: 500,
  });
  assert.equal(jpy.revenue, 5000);
  assert.equal(jpy.refunds, 500);
  assert.equal(STRIPE_CHARGES_ENDPOINT, "https://api.stripe.com/v1/charges");
});

test("Failed Stripe charges do not inflate payment count or revenue", () => {
  const record = normaliseStripeCharge({
    id: "ch_failed",
    created: 1792495800,
    currency: "gbp",
    status: "failed",
    paid: false,
    amount: 5000,
    amount_refunded: 0,
  });
  assert.equal(record.payments, 0);
  assert.equal(record.revenue, 0);
});

test("Shopify executor restricts host and uses a read-only orders GraphQL query", async () => {
  const adapter = await source("../features/integrationPlatform/marketingCommerceProviderAdapters.js");
  assert.match(adapter, /myshopify\\\.com/);
  assert.match(adapter, /orders\(first: \$first/);
  assert.match(adapter, /sortKey: CREATED_AT/);
  assert.match(adapter, /x-shopify-access-token/);
  assert.match(adapter, /method: "POST"/);
  assert.doesNotMatch(adapter, /mutation\s+/i);
  assert.doesNotMatch(adapter, /orderCreate|orderUpdate|refundCreate/i);
});

test("Stripe executor uses read-only charge listing with bounded created window and cursor pagination", async () => {
  const adapter = await source("../features/integrationPlatform/marketingCommerceProviderAdapters.js");
  assert.match(adapter, /STRIPE_CHARGES_ENDPOINT = "https:\/\/api\.stripe\.com\/v1\/charges"/);
  assert.match(adapter, /created\[gte\]/);
  assert.match(adapter, /created\[lte\]/);
  assert.match(adapter, /starting_after/);
  assert.match(adapter, /method: "GET"/);
  assert.doesNotMatch(adapter, /\/v1\/refunds/);
  assert.doesNotMatch(adapter, /\/v1\/payment_intents/);
});

test("Commerce executors remain behind the existing hard provider execution lock", async () => {
  const runner = await source("../features/integrationPlatform/marketingProviderRunService.js");
  assert.match(runner, /COMMERCE_PROVIDERS/);
  assert.match(runner, /"shopify"/);
  assert.match(runner, /"stripe"/);
  const lockIndex = runner.indexOf("liveProviderExecution === false");
  const dispatchIndex = runner.indexOf("fetchMarketingCommerceProviderRecords");
  assert.ok(lockIndex >= 0 && dispatchIndex > lockIndex, "execution lock must run before commerce provider dispatch");
});
