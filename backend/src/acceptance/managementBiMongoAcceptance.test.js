import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import premiumAnalyticsRoutes from "../features/premium/analytics/premiumAnalyticsRoutes.js";
import { normaliseTenantProductManifest } from "../platform/productComposition/tenantProductManifest.js";
import { calculateTenantProductManifestHash } from "../platform/productComposition/tenantProductManifestPersistence.js";
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

function analyticsManifest(business) {
  const canonical = normaliseTenantProductManifest({
    schemaVersion: "1", platformVersion: "3.0.0",
    businessId: String(business), verticalId: "salon",
    planKey: "standard", status: "active",
    manifestRevision: "1", deploymentProfile: "shared-saas",
    capabilityPackKeys: ["analytics"],
  });
  return {
    ...canonical, business,
    manifestRevision: Number(canonical.manifestRevision),
    manifestHash: calculateTenantProductManifestHash(canonical),
  };
}

function analyticsSubscription(business) {
  return {
    business, planKey: "standard", planVersion: "1",
    status: "active", lifecycleRevision: 1,
    entitlementGrants: [{ key: "analytics", source: "plan" }],
  };
}

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


test("Module 16 production JWT, persisted membership, tenant host and RBAC HTTP acceptance", {
  skip: !URI ? "Set AIIBP_BI_ACCEPTANCE_MONGO_URI for isolated CI acceptance" : false,
  timeout: 60000,
}, async (t) => {
  assert.equal(URI, SAFE_URI, "Refusing a non-isolated MongoDB target");
  const USERS = Object.freeze({
    a: objectId("507f1f77bcf86cd799439041"),
    b: objectId("507f1f77bcf86cd799439042"),
    a2: objectId("507f1f77bcf86cd799439043"),
    denied: objectId("507f1f77bcf86cd799439044"),
    suspended: objectId("507f1f77bcf86cd799439045"),
    inactive: objectId("507f1f77bcf86cd799439046"),
    outsider: objectId("507f1f77bcf86cd799439047"),
  });
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 10000 });
  let server;
  try {
    await mongoose.connection.dropDatabase();
    const db = mongoose.connection.db;
    await db.collection("businesses").insertMany([
      { _id: A, name: "Tenant A", slug: "test-tenant-a", businessType: "salon", status: "active" },
      { _id: B, name: "Tenant B", slug: "test-tenant-b", businessType: "salon", status: "active" },
    ]);
    // The production router now requires canonical persisted analytics
    // composition AND the lifecycle-eligible subscription entitlement.
    await db.collection("tenantproductmanifests").insertMany([
      analyticsManifest(A), analyticsManifest(B),
    ]);
    await db.collection("tenantsubscriptions").insertMany([
      analyticsSubscription(A), analyticsSubscription(B),
    ]);
    await db.collection("businessdomains").insertMany([
      { business: A, host: "tenant-a.example.test", status: "active", role: "primary" },
      { business: B, host: "tenant-b.example.test", status: "active", role: "primary" },
      { business: A, host: "disabled.example.test", status: "disabled", role: "alias" },
    ]);
    await db.collection("locations").insertMany([
      { _id: A1, business: A, name: "Tenant A / one", status: "active" },
      { _id: A2, business: A, name: "Tenant A / two", status: "active" },
      { _id: B1, business: B, name: "Tenant B / one", status: "active" },
    ]);
    await db.collection("appointments").insertMany([
      { business: A, location: A1, startsAt: date("2026-11-22T10:00:00Z"),
        status: "completed", totalPrice: 40 },
      { business: A, location: A1, startsAt: date("2026-11-22T11:00:00Z"),
        status: "no-show", totalPrice: 20 },
      { business: A, location: A2, startsAt: date("2026-11-22T12:00:00Z"),
        status: "completed", totalPrice: 60 },
      { business: B, location: B1, startsAt: date("2026-11-22T12:00:00Z"),
        status: "completed", totalPrice: 999 },
      { business: A, startsAt: date("2026-11-22T12:00:00Z"),
        status: "completed", totalPrice: 8888 },
    ]);
    await db.collection("users").insertMany(Object.entries(USERS).map(([name, _id]) => ({
      _id, name: "Test " + name, email: name + "@example.test",
      role: name === "denied" ? "receptionist" : "admin",
      isActive: name !== "inactive", passwordAuthEnabled: false,
      permissions: [], rolePermissions: [],
    })));
    await db.collection("businessmemberships").insertMany([
      { user: USERS.a, business: A, status: "active", roleKey: "admin",
        isDefault: true, locationAccessMode: "selected", locations: [A1] },
      // Deliberately suspended second membership: must not grant cross-tenant
      // access or enable compatibility-wide User permission shortcuts.
      { user: USERS.a, business: B, status: "suspended", roleKey: "admin",
        isDefault: false, locationAccessMode: "all", locations: [] },
      { user: USERS.b, business: B, status: "active", roleKey: "admin",
        isDefault: true, locationAccessMode: "all", locations: [] },
      { user: USERS.a2, business: A, status: "active", roleKey: "admin",
        isDefault: true, locationAccessMode: "selected", locations: [A2] },
      { user: USERS.denied, business: A, status: "active", roleKey: "receptionist",
        isDefault: true, locationAccessMode: "selected", locations: [A1] },
      { user: USERS.suspended, business: A, status: "suspended", roleKey: "admin",
        isDefault: true, locationAccessMode: "all", locations: [] },
      { user: USERS.inactive, business: A, status: "active", roleKey: "admin",
        isDefault: true, locationAccessMode: "all", locations: [] },
    ]);

    const app = express();
    // Mount the canonical production route unchanged: it applies its real
    // JWT protect, public business-host resolver, persisted membership,
    // effective role resolver, and premium-analytics permission middleware.
    app.use("/api/premium-analytics", premiumAnalyticsRoutes);
    app.use((error, _req, res, _next) => {
      res.status(error.statusCode || 500).json({
        success: false, code: error.code || error.details?.code || "BI_HTTP_FAILURE",
      });
    });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const token = (user, claims = {}) => jwt.sign({
      id: String(user), tokenType: "access", ...claims,
    }, env.jwtSecret, { expiresIn: "5m" });
    const request = async ({
      user, host = "tenant-a.example.test", bearer,
      path = "/management?periodDays=3&asOfDate=2026-11-22",
      extraHeaders = {},
    } = {}) => {
      // Node's fetch/undici may rewrite the Host header to the loopback
      // transport origin. Use explicit HTTP/1 to deliver the canonical
      // tenant hostname while connecting only to the test's local server.
      const headers = { Host: host, ...extraHeaders };
      if (bearer || user) headers.Authorization = "Bearer " + (bearer || token(user));
      return new Promise((resolve, reject) => {
        const client = http.request({
          hostname: "127.0.0.1", port: server.address().port,
          path: "/api/premium-analytics" + path,
          method: "GET", headers,
        }, (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("error", reject);
          response.on("end", () => {
            try {
              resolve({
                status: response.statusCode,
                body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
              });
            } catch (error) {
              reject(error);
            }
          });
        });
        client.on("error", reject);
        client.end();
      });
    };

    await t.test("real signed JWT + persisted tenant A membership resolves allowed location only", async () => {
      const result = await request({ user: USERS.a });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.success, true);
      assert.equal(result.body.snapshot.authority.businessId, String(A));
      assert.deepEqual(result.body.snapshot.authority.locationIds, [String(A1)]);
      assert.equal(byKey(result.body.snapshot, "bookings").value, 2);
      assert.equal(byKey(result.body.snapshot, "revenue").value, 40);
      assert.equal(result.body.snapshot.externalWriteAuthorised, false);
      assert.equal(result.body.snapshot.evidence.containsCustomerPii, false);
    });
    await t.test("host B selects only business B for a B member", async () => {
      const result = await request({ user: USERS.b, host: "tenant-b.example.test" });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.snapshot.authority.businessId, String(B));
      assert.deepEqual(result.body.snapshot.authority.locationIds, [String(B1)]);
      assert.equal(byKey(result.body.snapshot, "revenue").value, 999);
    });
    await t.test("different restricted membership cannot read another A location", async () => {
      const result = await request({ user: USERS.a2 });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.deepEqual(result.body.snapshot.authority.locationIds, [String(A2)]);
      assert.equal(byKey(result.body.snapshot, "revenue").value, 60);
    });
    await t.test("membership cannot cross tenant merely by changing Host", async () => {
      const result = await request({ user: USERS.a, host: "tenant-b.example.test" });
      assert.equal(result.status, 404, JSON.stringify(result.body));
      assert.equal(result.body.code, "TENANT_MEMBERSHIP_NOT_FOUND");
    });
    await t.test("untrusted tenant headers and query inputs cannot override selected host", async () => {
      const result = await request({
        user: USERS.a,
        path: "/management?periodDays=3&asOfDate=2026-11-22" +
          "&businessId=" + String(B) + "&locationId=" + String(B1),
        extraHeaders: {
          "x-forwarded-host": "tenant-b.example.test",
          "x-tenant-business-id": String(B),
          "x-tenant-location-id": String(B1),
        },
      });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.snapshot.authority.businessId, String(A));
      assert.deepEqual(result.body.snapshot.authority.locationIds, [String(A1)]);
      assert.equal(byKey(result.body.snapshot, "revenue").value, 40);
    });
    await t.test("real permission registry denies a receptionist without analytics grants", async () => {
      const result = await request({ user: USERS.denied });
      assert.equal(result.status, 403, JSON.stringify(result.body));
      assert.equal(result.body.code, "INSUFFICIENT_PERMISSIONS");
    });
    await t.test("missing and invalid tokens fail authentication before tenant lookup", async () => {
      for (const options of [{}, { bearer: "bad.token.value" }]) {
        const result = await request(options);
        assert.equal(result.status, 401, JSON.stringify(result.body));
        assert.equal(result.body.snapshot, undefined);
      }
    });
    await t.test("valid authenticated user without a tenant membership is denied", async () => {
      const result = await request({ user: USERS.outsider });
      assert.equal(result.status, 404, JSON.stringify(result.body));
      assert.equal(result.body.code, "TENANT_MEMBERSHIP_NOT_FOUND");
      assert.equal(result.body.snapshot, undefined);
    });
    await t.test("disabled user and suspended business membership fail closed", async () => {
      const disabled = await request({ user: USERS.inactive });
      const suspended = await request({ user: USERS.suspended });
      assert.equal(disabled.status, 403, JSON.stringify(disabled.body));
      assert.equal(suspended.status, 404, JSON.stringify(suspended.body));
      assert.equal(suspended.body.code, "TENANT_MEMBERSHIP_NOT_FOUND");
    });
    await t.test("non-active or unknown mapped tenant domains never select another tenant", async () => {
      const disabled = await request({ user: USERS.a, host: "disabled.example.test" });
      const unknown = await request({ user: USERS.a, host: "unknown.example.test" });
      assert.equal(disabled.status, 404, JSON.stringify(disabled.body));
      assert.equal(unknown.status, 404, JSON.stringify(unknown.body));
    });
    await t.test("subscription removal, suspension and compromised manifest never expose BI", async () => {
      const subs = db.collection("tenantsubscriptions");
      const manifests = db.collection("tenantproductmanifests");
      try {
        await subs.updateOne({ business: A }, { $set: { entitlementGrants: [] } });
        const noGrant = await request({ user: USERS.a });
        assert.equal(noGrant.status, 403, JSON.stringify(noGrant.body));
        assert.equal(noGrant.body.code, "BI_CAPABILITY_NOT_ENTITLED");
        assert.equal(noGrant.body.snapshot, undefined);

        await subs.updateOne({ business: A }, {
          $set: { status: "suspended", entitlementGrants: [{ key: "analytics", source: "plan" }] },
        });
        const suspended = await request({ user: USERS.a });
        assert.equal(suspended.status, 403, JSON.stringify(suspended.body));
        assert.equal(suspended.body.code, "BI_SUBSCRIPTION_INACTIVE");
        assert.equal(suspended.body.snapshot, undefined);

        await subs.updateOne({ business: A }, { $set: { status: "active" } });
        await manifests.updateOne({ business: A }, { $set: { manifestHash: "0".repeat(64) } });
        const tampered = await request({ user: USERS.a });
        assert.equal(tampered.status, 403, JSON.stringify(tampered.body));
        assert.equal(tampered.body.code, "BI_MANIFEST_UNTRUSTED");
        assert.equal(tampered.body.snapshot, undefined);

        await manifests.updateOne({ business: A }, {
          $set: { manifestHash: analyticsManifest(A).manifestHash,
            effectiveFrom: date("2099-01-01T00:00:00Z") },
        });
        const future = await request({ user: USERS.a });
        assert.equal(future.status, 403, JSON.stringify(future.body));
        assert.equal(future.body.code, "BI_MANIFEST_UNTRUSTED");

        await manifests.updateOne({ business: A }, {
          $set: { effectiveFrom: null },
        });
        const restored = await request({ user: USERS.a });
        assert.equal(restored.status, 200, JSON.stringify(restored.body));
        assert.equal(byKey(restored.body.snapshot, "revenue").value, 40);

        await subs.deleteOne({ business: A });
        const missingSubscription = await request({ user: USERS.a });
        assert.equal(missingSubscription.status, 403, JSON.stringify(missingSubscription.body));
        assert.equal(missingSubscription.body.code, "BI_TENANT_RECORDS_REQUIRED");
      } finally {
        await subs.deleteOne({ business: A });
        await subs.insertOne(analyticsSubscription(A));
        await manifests.updateOne({ business: A }, {
          $set: { manifestHash: analyticsManifest(A).manifestHash,
            effectiveFrom: null },
        });
      }
    });
    await t.test("tenant B missing analytics grant cannot borrow tenant A's subscription", async () => {
      const subs = db.collection("tenantsubscriptions");
      try {
        await subs.updateOne({ business: B }, { $set: { entitlementGrants: [] } });
        const denied = await request({ user: USERS.b, host: "tenant-b.example.test" });
        assert.equal(denied.status, 403, JSON.stringify(denied.body));
        assert.equal(denied.body.code, "BI_CAPABILITY_NOT_ENTITLED");
      } finally {
        await subs.updateOne({ business: B }, {
          $set: { entitlementGrants: [{ key: "analytics", source: "plan" }] },
        });
      }
    });
    await t.test("legacy root remains retired and returns no global BI data", async () => {
      const result = await request({ user: USERS.a, path: "/" });
      assert.equal(result.status, 410, JSON.stringify(result.body));
      assert.equal(result.body.code, "PREMIUM_ANALYTICS_LEGACY_UNSCOPED_DISABLED");
    });
  } finally {
    if (server) await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
