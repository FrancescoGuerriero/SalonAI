import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { readFile } from "node:fs/promises";

import Product from "../features/commerce/Product.js";
import Order from "../features/commerce/Order.js";
import Payment from "../features/commerce/Payment.js";
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

test("Order validation accepts an appointment payment without a product", () => {
  const appointmentId = new mongoose.Types.ObjectId();
  const appointmentPaymentId = new mongoose.Types.ObjectId();
  const order = new Order({
    user: new mongoose.Types.ObjectId(),
    contact: {
      name: "Cart Customer",
      email: "cart@example.com",
    },
    items: [
      {
        itemType: "appointment",
        appointment: appointmentId,
        appointmentPayment: appointmentPaymentId,
        paymentPurpose: "appointment_balance",
        sku: "APPOINTMENT-TEST",
        name: "Beard Trim balance",
        quantity: 1,
        unitPrice: 15,
        lineTotal: 15,
      },
    ],
    appointmentSubtotal: 15,
    total: 15,
  });

  assert.equal(order.validateSync(), undefined);
  assert.equal(order.items[0].itemType, "appointment");
  assert.equal(String(order.items[0].appointment), String(appointmentId));
  assert.equal(order.items[0].product, undefined);
});

test("Order validation accepts an immutable service package purchase snapshot", () => {
  const servicePackageId =
    new mongoose.Types.ObjectId();
  const serviceId =
    new mongoose.Types.ObjectId();

  const order = new Order({
    user:
      new mongoose.Types.ObjectId(),
    customer:
      new mongoose.Types.ObjectId(),
    contact: {
      name: "Package Customer",
      email:
        "package@example.com",
    },
    items: [
      {
        itemType:
          "service_package",
        servicePackage:
          servicePackageId,
        packageSnapshot: {
          validityDays: 180,
          includedServices: [
            {
              service:
                serviceId,
              sessions: 3,
            },
          ],
        },
        sku:
          "PACKAGE-COLOUR-3",
        name:
          "Three colour visits",
        quantity: 1,
        unitPrice: 250,
        lineTotal: 250,
      },
    ],
    servicePackageSubtotal: 250,
    total: 250,
  });

  assert.equal(
    order.validateSync(),
    undefined
  );
  assert.equal(
    order.items[0].itemType,
    "service_package"
  );
  assert.equal(
    String(
      order.items[0]
        .servicePackage
    ),
    String(servicePackageId)
  );
  assert.equal(
    order.items[0]
      .packageSnapshot
      .includedServices[0]
      .sessions,
    3
  );
});

test("Payment validation accepts a mixed commerce order", () => {
  const payment = new Payment({
    user: new mongoose.Types.ObjectId(),
    order: new mongoose.Types.ObjectId(),
    purpose: "mixed_order",
    amount: 44.25,
    currency: "GBP",
    provider: "stripe",
    status: "pending",
  });

  assert.equal(payment.validateSync(), undefined);
});

test("Payment validation accepts a dedicated service package order purpose", () => {
  const payment = new Payment({
    user:
      new mongoose.Types.ObjectId(),
    customer:
      new mongoose.Types.ObjectId(),
    order:
      new mongoose.Types.ObjectId(),
    purpose:
      "service_package_order",
    amount: 250,
    currency: "GBP",
    provider: "stripe",
    status: "pending",
  });

  assert.equal(
    payment.validateSync(),
    undefined
  );
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
    appointmentDepositPercentage: 25,
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

test("Public product listings use a lightweight card projection", async () => {
  const serviceSource =
    await readFile(
      new URL(
        "../features/commerce/commerceService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    serviceSource,
    /const PUBLIC_PRODUCT_LIST_FIELDS = \[/
  );
  assert.match(
    serviceSource,
    /itemQuery\.slice\(\s*"images",\s*1\s*\)/
  );
  assert.doesNotMatch(
    serviceSource.match(
      /const PUBLIC_PRODUCT_LIST_FIELDS = \[[\s\S]*?\]\.join\(" "\);/
    )?.[0] || "",
    /officialDescription|costPrice|reorderLevel/
  );
  assert.match(
    serviceSource,
    /query\.facets/
  );
  assert.match(
    serviceSource,
    /includeFacets[\s\S]*Product\.distinct/
  );
});
