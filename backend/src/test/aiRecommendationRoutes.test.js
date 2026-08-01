import assert from "node:assert/strict";
import http from "node:http";
import {
  after,
  before,
  test,
} from "node:test";

import app from "../app.js";
import {
  normaliseHaircarePayload,
} from "../features/aiRecommendations/aiRecommendationService.js";

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

for (const request of [
  {
    method: "GET",
    pathname: "/api/ai/status",
  },
  {
    method: "POST",
    pathname: "/api/ai/haircare/recommendations",
    body: {
      hairType: "curly",
    },
  },
]) {
  test(`${request.method} ${request.pathname} rejects unauthenticated requests`, async () => {
    const response = await fetch(
      `${baseUrl}${request.pathname}`,
      {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
        },
        body:
          request.body === undefined
            ? undefined
            : JSON.stringify(request.body),
      }
    );

    assert.equal(response.status, 401);

    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(
      payload.code,
      "AUTHENTICATION_REQUIRED"
    );
  });
}

test("haircare payload accepts frontend field names and emits the Python contract", () => {
  const payload = normaliseHaircarePayload({
    customerId: " customer-123 ",
    hairType: "Curly",
    texture: "Coarse",
    concerns: [
      "dryness",
      "damage",
      "dryness",
    ],
    chemicalServices: [
      "colour",
      "bleach",
    ],
    heatStylingPerWeek: 4,
    maintenancePreference: "high",
    scalpSensitive: true,
    notes: "  Uses heat frequently.  ",
  });

  assert.deepEqual(payload, {
    customer_id: "customer-123",
    hair_type: "curly",
    texture: "coarse",
    concerns: [
      "dryness",
      "damage",
    ],
    chemical_services: [
      "colour",
      "bleach",
    ],
    heat_styling_per_week: 4,
    maintenance_preference: "high",
    scalp_sensitive: true,
    notes: "Uses heat frequently.",
  });
});

test("haircare payload rejects unsupported hair types", () => {
  assert.throws(
    () =>
      normaliseHaircarePayload({
        hairType: "unknown",
      }),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(
        error.code,
        "AI_RECOMMENDATION_VALIDATION_ERROR"
      );
      assert.equal(
        error.details.field,
        "hair_type"
      );
      return true;
    }
  );
});

test("haircare payload rejects none combined with chemical services", () => {
  assert.throws(
    () =>
      normaliseHaircarePayload({
        hairType: "straight",
        chemicalServices: [
          "none",
          "colour",
        ],
      }),
    (error) => {
      assert.equal(error.statusCode, 422);
      assert.equal(
        error.details.field,
        "chemical_services"
      );
      return true;
    }
  );
});

test("haircare payload applies safe defaults", () => {
  const payload = normaliseHaircarePayload({
    hairType: "wavy",
  });

  assert.deepEqual(payload, {
    hair_type: "wavy",
    texture: "medium",
    concerns: [],
    chemical_services: [],
    heat_styling_per_week: 0,
    maintenance_preference: "medium",
    scalp_sensitive: false,
    notes: "",
  });
});
