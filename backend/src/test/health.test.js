import assert from "node:assert/strict";
import {
  after,
  before,
  test,
} from "node:test";
import http from "node:http";

import app from "../app.js";

let server;
let baseUrl;

before(async () => {
  server =
    http.createServer(app);

  await new Promise(
    (resolve) => {
      server.listen(
        0,
        "127.0.0.1",
        resolve
      );
    }
  );

  const address =
    server.address();

  baseUrl =
    `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise(
    (resolve, reject) => {
      server.close(
        (error) =>
          error
            ? reject(error)
            : resolve()
      );
    }
  );
});

test(
  "GET /api/health returns a healthy response",
  async () => {
    const response =
      await fetch(
        `${baseUrl}/api/health`
      );

    assert.equal(
      response.status,
      200
    );

    const body =
      await response.json();

    assert.equal(
      body.success,
      true
    );

    assert.equal(
      body.status,
      "healthy"
    );
  }
);


test(
  "GET /api/commerce/config returns safe public checkout settings",
  async () => {
    const response = await fetch(`${baseUrl}/api/commerce/config`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.currency, "GBP");
    assert.equal(body.paymentMode, "console");
    assert.equal(typeof body.deliveryFee, "number");
  }
);

test(
  "unknown routes return structured JSON",
  async () => {
    const response =
      await fetch(
        `${baseUrl}/api/not-a-route`
      );

    assert.equal(
      response.status,
      404
    );

    const body =
      await response.json();

    assert.equal(
      body.success,
      false
    );

    assert.equal(
      body.code,
      "ROUTE_NOT_FOUND"
    );
  }
);

const protectedRequests = [
  ["GET", "/api/dashboard/stats"],
  ["GET", "/api/dashboard/insights"],
  ["GET", "/api/dashboard/customer-retention"],
  ["GET", "/api/communication-templates"],
  ["GET", "/api/customer-contacts"],
  ["GET", "/api/customers"],
  ["GET", "/api/future/templates"],
  ["GET", "/api/admin/dashboard"],
  ["POST", "/api/services"],
  ["POST", "/api/commerce/products"],
  ["GET", "/api/commerce/inventory/products"],
  ["GET", "/api/commerce/inventory/summary"],
  ["POST", "/api/commerce/checkout"],
  ["GET", "/api/commerce/orders/mine"],
];

for (const [method, pathname] of protectedRequests) {
  test(
    `${method} ${pathname} rejects unauthenticated requests`,
    async () => {
      const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: method === "GET" ? undefined : JSON.stringify({}),
      });

      assert.equal(response.status, 401);

      const body = await response.json();

      assert.equal(body.success, false);
      assert.equal(body.code, "AUTHENTICATION_REQUIRED");
    }
  );
}


test(
  "POST /api/commerce/webhooks/stripe rejects webhooks when Stripe mode is disabled",
  async () => {
    const response = await fetch(
      `${baseUrl}/api/commerce/webhooks/stripe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      }
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.code, "BAD_REQUEST");
  }
);
