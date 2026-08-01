import assert from "node:assert/strict";
import http from "node:http";
import {
  after,
  before,
  test,
} from "node:test";

import app from "../app.js";
import {
  buildCustomerSummaryPayload,
} from "../features/aiRecommendations/aiCustomerSummaryService.js";

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

test("customer summary route rejects unauthenticated requests", async () => {
  const response = await fetch(
    `${baseUrl}/api/ai/customers/507f1f77bcf86cd799439011/summary`
  );

  assert.equal(response.status, 401);

  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.code, "AUTHENTICATION_REQUIRED");
});

test("customer summary payload excludes contact and private-note fields", () => {
  const payload = buildCustomerSummaryPayload({
    customer: {
      _id: "507f1f77bcf86cd799439011",
      firstName: "Alex",
      lastName: "Morgan",
      email: "alex@example.com",
      phone: "07000000000",
      address: {
        line1: "Private address",
      },
      loyaltyTier: "gold",
      totalSpent: 240,
      visitCount: 3,
      hairProfile: {
        hairType: "curly",
        allergies: ["PPD"],
      },
    },
    appointments: [],
    notes: [
      {
        type: "preference",
        content: "Prefers quiet appointments.",
        visibility: "staff",
      },
    ],
    orders: [],
  });

  assert.equal(payload.display_name, "Alex Morgan");
  assert.equal(payload.metrics.total_spent, 240);
  assert.deepEqual(payload.hair_profile.allergies, ["PPD"]);
  assert.equal(payload.email, undefined);
  assert.equal(payload.phone, undefined);
  assert.equal(payload.address, undefined);
  assert.equal(payload.recent_notes[0].visibility, undefined);
});

test("customer summary payload separates upcoming and recent appointments", () => {
  const now = new Date("2026-07-28T12:00:00.000Z");

  const payload = buildCustomerSummaryPayload({
    customer: {
      _id: "507f1f77bcf86cd799439011",
      preferredName: "Alex",
    },
    appointments: [
      {
        _id: "507f1f77bcf86cd799439012",
        status: "confirmed",
        startsAt: "2026-07-29T12:00:00.000Z",
        appointmentTime: "13:00",
        service: {
          name: "Cut and finish",
        },
      },
      {
        _id: "507f1f77bcf86cd799439013",
        status: "completed",
        startsAt: "2026-07-20T12:00:00.000Z",
        service: {
          name: "Colour",
        },
        amountPaid: 100,
      },
    ],
    now,
  });

  assert.equal(payload.upcoming_appointments.length, 1);
  assert.equal(payload.recent_appointments.length, 1);
  assert.equal(
    payload.upcoming_appointments[0].service_name,
    "Cut and finish"
  );
  assert.equal(payload.metrics.completed_appointments, 1);
});

test("customer summary payload supports concise mode", () => {
  const payload = buildCustomerSummaryPayload({
    customer: {
      _id: "507f1f77bcf86cd799439011",
      preferredName: "Alex",
    },
    summaryStyle: "concise",
  });

  assert.equal(payload.summary_style, "concise");
});
