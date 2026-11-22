import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import { buildManagementBiSnapshot } from "../features/analytics/managementBiService.js";
import { getManagementBi } from "../features/premium/analytics/premiumAnalyticsController.js";
import { createTrustedTenantContextMiddleware } from "../platform/tenancy/trustedTenantMiddleware.js";
import {
  createEffectiveAuthorityMiddleware, requireEffectivePermissions,
} from "../middleware/effectiveAuthorityMiddleware.js";
import asyncHandler from "../middleware/asyncHandler.js";

const URI = process.env.AIIBP_BI_ACCEPTANCE_MONGO_URI || "";
const SAFE_URI = "mongodb://127.0.0.1:27017/aiibp_bi_acceptance_ci";
const objectId = (hex) => new mongoose.Types.ObjectId(hex);
const A = objectId("507f1f77bcf86cd799439021");
const B = objectId("507f1f77bcf86cd799439022");
const A1 = objectId("507f1f77bcf86cd799439031");
const A2 = objectId("507f1f77bcf86cd799439032");
const B1 = objectId("507f1f77bcf86cd799439033");
const A_ARCHIVED = objectId("507f1f77bcf86cd799439034");
const date = (text) => new Date(text);
const authority = (business, locationAccessMode, locationId = null, allowedLocationIds = null) => ({
  businessId: String(business), locationAccessMode,
  locationId: locationId ? String(locationId) : null,
  allowedLocationIds: allowedLocationIds?.map(String) || null,
});
const byKey = (snapshot, key) => snapshot.metrics.find((row) => row.key === key);

function createHttpAcceptanceApp() {
  const allA = authority(A, "all");
  const selectedA = authority(A, "selected", A1, [A1]);
  const allB = authority(B, "all");
  // These identities are created exclusively by the test's server-side
  // adapter; no production auth or tenant selection is overridden.
  const principals = Object.freeze({
    "a-all": { tenant: allA, permissions: ["premium-analytics:read"] },
    "a-selected": { tenant: selectedA, permissions: ["premium-analytics:read"] },
    "b-all": { tenant: allB, permissions: ["premium-analytics:read"] },
    "a-denied": { tenant: allA, permissions: [] },
    "a-foreign-location": {
      tenant: authority(A, "selected", B1, [B1]),
      permissions: ["premium-analytics:read"],
    },
  });
  const app = express();
  app.use((req, _res, next) => {
    const principal = principals[req.get("x-bi-acceptance-principal")];
    if (principal) req.user = { _id: objectId("507f1f77bcf86cd799439041"), principal };
    next();
  });
  const trusted = createTrustedTenantContextMiddleware({
    selectionResolver: () => ({ businessId: null, locationId: null }),
    contextResolver: async ({ authenticatedUser }) => authenticatedUser.principal.tenant,
  });
  const effective = createEffectiveAuthorityMiddleware({
    authorityResolver: async ({ user, tenantContext }) => ({
      ...tenantContext, permissions: user.principal.permissions,
    }),
  });
  app.get("/api/premium-analytics/management", trusted, effective,
    requireEffectivePermissions("premium-analytics:read"),
    asyncHandler(getManagementBi));
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({
      success: false, code: error.code || error.details?.code || "BI_ACCEPTANCE_ERROR",
    });
  });
  return app;
}

test("Module 16 Mongo acceptance refuses a remote, authenticated or production database", () => {
  for (const unsafe of [
    "mongodb://example.com:27017/aiibp_bi_acceptance_ci",
    "mongodb://127.0.0.1:27017/production",
    "mongodb://user:password@127.0.0.1:27017/aiibp_bi_acceptance_ci",
    "mongodb://127.0.0.1:27017/aiibp_bi_acceptance_ci?authSource=admin",
    "mongodb+srv://127.0.0.1/aiibp_bi_acceptance_ci",
  ]) assert.notEqual(unsafe, SAFE_URI);
  assert.equal(SAFE_URI, "mongodb://127.0.0.1:27017/aiibp_bi_acceptance_ci");
});

test("Module 16 real MongoDB tenant, location and KPI HTTP acceptance", {
  skip: !URI ? "Set AIIBP_BI_ACCEPTANCE_MONGO_URI for isolated CI acceptance" : false,
  timeout: 60000,
}, async (t) => {
  assert.equal(URI, SAFE_URI, "Refusing non-loopback or non-acceptance MongoDB URI");
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 10000 });
  let server;
  try {
    await mongoose.connection.dropDatabase();
    const database = mongoose.connection.db;
    await database.collection("locations").insertMany([
      { _id: A1, business: A, name: "Salon A1", status: "active" },
      { _id: A2, business: A, name: "Salon A2", status: "active" },
      { _id: A_ARCHIVED, business: A, name: "Old salon", status: "archived" },
      { _id: B1, business: B, name: "Salon B1", status: "active" },
    ]);
    const records = [
      { business: A, location: A1, startsAt: date("2026-11-22T10:00:00Z"),
        status: "completed", totalPrice: 100 },
      { business: A, location: A1, startsAt: date("2026-11-21T11:00:00Z"),
        status: "no-show", totalPrice: 50 },
      { business: A, location: A1, startsAt: date("2026-11-20T12:00:00Z"),
        status: "cancelled", totalPrice: 20 },
      { business: A, location: A1, startsAt: null,
        appointmentDate: date("2026-11-22T23:59:59.999Z"),
        status: "completed", totalPrice: 50 },
      { business: A, location: A2, startsAt: date("2026-11-20T00:00:00.000Z"),
        status: "completed", totalPrice: 80 },
      { business: A, location: A1, startsAt: date("2026-11-19T23:59:59.999Z"),
        status: "completed", totalPrice: 40 },
      { business: A, location: A1, startsAt: date("2026-11-17T00:00:00.000Z"),
        status: "confirmed", totalPrice: 20 },
      { business: A, location: A1, startsAt: date("2026-11-23T00:00:00Z"),
        status: "completed", totalPrice: 500 },
      { business: A, location: A_ARCHIVED,
        startsAt: date("2026-11-22T12:00:00Z"), status: "completed", totalPrice: 3000 },
      { business: B, location: B1, startsAt: date("2026-11-22T12:00:00Z"),
        status: "completed", totalPrice: 9999 },
      { location: A1, startsAt: date("2026-11-22T12:00:00Z"),
        status: "completed", totalPrice: 7777 },
      { business: A, startsAt: date("2026-11-22T12:00:00Z"),
        status: "completed", totalPrice: 6666 },
    ];
    await database.collection("appointments").insertMany(records);
    const sourceCount = await database.collection("appointments").countDocuments();
    const allA = await buildManagementBiSnapshot({
      effectiveAuthority: authority(A, "all"), periodDays: 3,
      asOfDate: "2026-11-22",
    });
    await t.test("real Mongo filters foreign, unowned, archived and out-of-window facts", () => {
      assert.equal(byKey(allA, "bookings").value, 5);
      assert.equal(byKey(allA, "completed").value, 3);
      assert.equal(byKey(allA, "revenue").value, 230);
      assert.equal(byKey(allA, "no-show-rate").value, 20);
      assert.equal(byKey(allA, "cancellation-rate").value, 20);
      assert.equal(byKey(allA, "revenue").previous_value, 40);
      assert.equal(byKey(allA, "bookings").previous_value, 2);
      assert.equal(allA.evidence.recordsMatched, 7);
      assert.deepEqual(allA.authority.locationIds, [String(A1), String(A2)]);
      assert.equal(allA.evidence.containsCustomerPii, false);
      assert.equal(allA.externalWriteAuthorised, false);
      assert.equal(allA.modelInferenceExecuted, false);
    });
    const selected = await buildManagementBiSnapshot({
      effectiveAuthority: authority(A, "selected", A1, [A1]),
      periodDays: 3, asOfDate: "2026-11-22",
    });
    await t.test("real Mongo selected location cannot borrow neighbouring location's KPIs", () => {
      assert.equal(byKey(selected, "bookings").value, 4);
      assert.equal(byKey(selected, "revenue").value, 150);
      assert.equal(byKey(selected, "no-show-rate").value, 25);
      assert.equal(selected.pythonAnalysis.available, true);
      assert.equal(selected.authority.locationIds.length, 1);
    });
    const other = await buildManagementBiSnapshot({
      effectiveAuthority: authority(B, "all"), periodDays: 3, asOfDate: "2026-11-22",
    });
    await t.test("real Mongo keeps another tenant's metrics separately attributable", () => {
      assert.equal(byKey(other, "revenue").value, 9999);
      assert.equal(byKey(other, "bookings").value, 1);
      assert.notEqual(allA.evidence.checksum, other.evidence.checksum);
    });

    // HTTP integration uses the production trusted-context/effective-RBAC
    // middleware factories and the actual management BI controller. A
    // TEST-ONLY principal adapter substitutes authentication and tenant
    // selection; this is not a production JWT/session acceptance test.
    server = http.createServer(createHttpAcceptanceApp());
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    const get = async (principal) => {
      const response = await fetch(base +
        "/api/premium-analytics/management?periodDays=3&asOfDate=2026-11-22", {
        headers: principal ? { "x-bi-acceptance-principal": principal } : {},
      });
      return { status: response.status, body: await response.json() };
    };
    await t.test("authenticated test principal gets canonical management BI over HTTP", async () => {
      const response = await get("a-all");
      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(byKey(response.body.snapshot, "revenue").value, 230);
      assert.equal(response.body.snapshot.authority.businessId, String(A));
      assert.equal(response.body.snapshot.externalWriteAuthorised, false);
    });
    await t.test("HTTP location and tenant principal isolation", async () => {
      const [a, b] = await Promise.all([get("a-selected"), get("b-all")]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.equal(byKey(a.body.snapshot, "revenue").value, 150);
      assert.equal(byKey(b.body.snapshot, "revenue").value, 9999);
      assert.deepEqual(a.body.snapshot.authority.locationIds, [String(A1)]);
      assert.deepEqual(b.body.snapshot.authority.locationIds, [String(B1)]);
    });
    await t.test("HTTP missing identity and missing permission fail closed", async () => {
      const [unauthenticated, forbidden] =
        await Promise.all([get(), get("a-denied")]);
      assert.equal(unauthenticated.status, 401);
      assert.equal(forbidden.status, 403);
    });
    await t.test("foreign location selection cannot expose foreign business KPIs", async () => {
      const response = await get("a-foreign-location");
      assert.equal(response.status, 200);
      assert.equal(byKey(response.body.snapshot, "bookings").value, 0);
      assert.equal(byKey(response.body.snapshot, "revenue").value, 0);
      assert.equal(response.body.snapshot.authority.businessId, String(A));
    });
    assert.equal(await database.collection("appointments").countDocuments(), sourceCount);
    assert.equal(await database.collection("locations").countDocuments(), 4);
  } finally {
    if (server) await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
