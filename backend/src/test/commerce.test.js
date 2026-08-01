import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import Product from "../features/commerce/Product.js";
import Order from "../features/commerce/Order.js";
import { commerceConfig } from "../features/commerce/commerceService.js";
import {
  createCheckoutPayment,
  paymentProviderMode,
} from "../providers/paymentProvider.js";

test("Product validation rejects invalid stock and missing catalogue fields", () => {
  const product = new Product({
    name: "",
    sku: "",
    slug: "",
    price: 10,
    stockQuantity: -1,
  });

  const error = product.validateSync();
  assert.ok(error);
  assert.ok(error.errors.name);
  assert.ok(error.errors.sku);
  assert.ok(error.errors.slug);
  assert.ok(error.errors.stockQuantity);
});

test("Order validation requires contact details and at least one item", () => {
  const order = new Order({
    user: new mongoose.Types.ObjectId(),
    contact: {},
    items: [],
  });

  const error = order.validateSync();
  assert.ok(error);
  assert.ok(error.errors["contact.name"]);
  assert.ok(error.errors["contact.email"]);
  assert.ok(error.errors.items);
});

test("Commerce config exposes GBP settings without payment credentials", () => {
  const previousMode = process.env.PAYMENT_PROVIDER_MODE;
  const previousFee = process.env.DELIVERY_FEE_GBP;

  process.env.PAYMENT_PROVIDER_MODE = "console";
  process.env.DELIVERY_FEE_GBP = "4.95";

  const config = commerceConfig();
  assert.deepEqual(config, {
    currency: "GBP",
    deliveryFee: 4.95,
    paymentMode: "console",
  });
  assert.equal("secretKey" in config, false);

  if (previousMode === undefined) delete process.env.PAYMENT_PROVIDER_MODE;
  else process.env.PAYMENT_PROVIDER_MODE = previousMode;
  if (previousFee === undefined) delete process.env.DELIVERY_FEE_GBP;
  else process.env.DELIVERY_FEE_GBP = previousFee;
});

test("Console checkout provider creates a safe pending payment", async () => {
  const previousMode = process.env.PAYMENT_PROVIDER_MODE;
  process.env.PAYMENT_PROVIDER_MODE = "mock";

  assert.equal(paymentProviderMode(), "console");

  const result = await createCheckoutPayment({
    order: {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: "SA-TEST-001",
      currency: "GBP",
      user: new mongoose.Types.ObjectId(),
    },
    items: [
      {
        name: "Test Product",
        sku: "TEST-001",
        quantity: 1,
        unitPrice: 10,
        image: "",
      },
    ],
    customerEmail: "customer@example.com",
    successUrl: "http://localhost/success",
    cancelUrl: "http://localhost/cancel",
  });

  assert.equal(result.provider, "console");
  assert.equal(result.status, "pending");
  assert.equal(result.checkoutUrl, "");
  assert.match(result.providerPaymentId, /^console_checkout_/);

  if (previousMode === undefined) delete process.env.PAYMENT_PROVIDER_MODE;
  else process.env.PAYMENT_PROVIDER_MODE = previousMode;
});
