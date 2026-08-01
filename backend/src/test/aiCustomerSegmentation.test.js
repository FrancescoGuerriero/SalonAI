import assert from "node:assert/strict";
import http from "node:http";
import {
  after,
  before,
  test,
} from "node:test";

import app from "../app.js";
import {
  buildCustomerSegmentationFeature,
  buildCustomerSegmentationPayload,
} from "../features/aiRecommendations/aiCustomerSegmentationService.js";

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) =>
      error ? reject(error) : resolve()
    );
  });
});

test("AI customer segmentation route rejects unauthenticated requests", async () => {
  const response = await fetch(
    `${baseUrl}/api/ai/customer-segmentation`
  );

  assert.equal(response.status, 401);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.code, "AUTHENTICATION_REQUIRED");
});

test("segmentation feature calculates behavioural metrics", () => {
  const feature = buildCustomerSegmentationFeature({
    customer: {
      _id: "507f1f77bcf86cd799439011",
      createdAt: "2025-01-01T00:00:00.000Z",
      communicationPreferences: {
        preferredChannel: "email",
        promotionalMessages: true,
      },
      marketing: {
        emailConsent: true,
      },
    },
    appointments: [
      {
        customer: "507f1f77bcf86cd799439011",
        status: "completed",
        startsAt: "2026-01-10T10:00:00.000Z",
        finalPrice: 100,
        discount: 10,
      },
      {
        customer: "507f1f77bcf86cd799439011",
        status: "completed",
        startsAt: "2026-03-10T10:00:00.000Z",
        finalPrice: 120,
        discount: 0,
      },
      {
        customer: "507f1f77bcf86cd799439011",
        status: "confirmed",
        startsAt: "2026-08-10T10:00:00.000Z",
      },
    ],
    orders: [
      {
        customer: "507f1f77bcf86cd799439011",
        total: 40,
      },
    ],
    contacts: [
      {
        customer: "507f1f77bcf86cd799439011",
        status: "opened",
      },
      {
        customer: "507f1f77bcf86cd799439011",
        status: "delivered",
      },
    ],
    now: new Date("2026-07-28T12:00:00.000Z"),
  });

  assert.equal(feature.completed_appointments, 2);
  assert.equal(feature.upcoming_appointments, 1);
  assert.equal(feature.service_spend, 220);
  assert.equal(feature.retail_spend, 40);
  assert.equal(feature.discount_usage_rate, 0.5);
  assert.equal(feature.marketing_engagement_rate, 0.5);
  assert.equal(feature.has_marketing_consent, true);
});

test("segmentation payload excludes names and contact details", () => {
  const payload = buildCustomerSegmentationPayload({
    customers: [
      {
        _id: "507f1f77bcf86cd799439011",
        firstName: "Alex",
        lastName: "Morgan",
        email: "alex@example.com",
        phone: "07000000000",
        address: {
          line1: "Private address",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    now: new Date("2026-07-28T12:00:00.000Z"),
  });

  const feature = payload.customers[0];
  assert.equal(feature.customer_ref, "507f1f77bcf86cd799439011");
  assert.equal(feature.firstName, undefined);
  assert.equal(feature.display_name, undefined);
  assert.equal(feature.email, undefined);
  assert.equal(feature.phone, undefined);
  assert.equal(feature.address, undefined);
});
