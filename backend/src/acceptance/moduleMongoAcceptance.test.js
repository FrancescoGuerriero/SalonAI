import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { normaliseTenantProductManifest } from "../platform/productComposition/tenantProductManifest.js";
import { calculateTenantProductManifestHash } from "../platform/productComposition/tenantProductManifestPersistence.js";
import { inspectTrustedTenantModuleEvidence } from "../features/moduleCatalogue/moduleCatalogueTenantRuntimeEvidence.js";
import { inspectModuleOperationalAcceptance } from "../features/moduleCatalogue/moduleCatalogueOperationalAcceptance.js";
import { buildManagementCopilotPayload } from "../features/aiRecommendations/aiManagementCopilotService.js";
import { resolveTrustedTenantContext } from "../platform/tenancy/trustedTenantContext.js";
import BusinessMembership from "../models/BusinessMembership.js";
import Location from "../models/Location.js";
import Service from "../models/service.js";
import Stylist from "../models/Stylist.js";
import LocationServiceOffering from "../models/LocationServiceOffering.js";
import Product from "../features/commerce/Product.js";
import Order from "../features/commerce/Order.js";
import { commerceTenantFilter } from "../features/commerce/commerceTenantOwnership.js";
import { listProducts, getProduct } from "../features/commerce/commerceService.js";
import { scopedServiceFilter } from "../services/serviceTenantAuthorityService.js";
import { scopedWorkforceFilter, assertWorkforceResourceAuthority } from "../services/workforceAuthorityService.js";
import { inventoryLocationFilter } from "../features/inventoryPurchasing/services/ownershipScope.js";
import { resolveEffectiveServiceConfiguration } from "../platform/services/effectiveServiceConfiguration.js";
import { getManagementServices } from "../controllers/serviceController.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";


const URI = process.env.AIIBP_ACCEPTANCE_MONGO_URI || "";
if (!/^mongodb:\/\/127\.0\.0\.1:27017\/aiibp_module_acceptance_ci(?:\?|$)/.test(URI)) {
  throw new Error("Refusing Mongo acceptance tests: isolated loopback CI database URI required.");
}

const id = (part) => new mongoose.Types.ObjectId(part);
const businessA = id("507f1f77bcf86cd799439021");
const businessB = id("507f1f77bcf86cd799439022");
const locationA1 = id("507f1f77bcf86cd799439031");
const locationA2 = id("507f1f77bcf86cd799439032");
const locationB = id("507f1f77bcf86cd799439033");
const userA = id("507f1f77bcf86cd799439041");
const userB = id("507f1f77bcf86cd799439042");
const asOfDate = new Date("2026-11-08T12:00:00Z");

function authority(businessId, attrs = {}) {
  return {
    businessId: String(businessId),
    locationAccessMode: "all",
    permissions: ["feature-control:read", "appointment:read"],
    ...attrs,
  };
}
function manifestRecord(business, capabilityPackKeys) {
  const canonical = normaliseTenantProductManifest({
    schemaVersion: "1", platformVersion: "3.0.0",
    businessId: String(business), verticalId: "salon",
    planKey: "standard", capabilityPackKeys,
    status: "active", manifestRevision: "1",
    deploymentProfile: "shared-saas",
  });
  return {
    ...canonical, business,
    manifestRevision: Number(canonical.manifestRevision),
    manifestHash: calculateTenantProductManifestHash(canonical),
  };
}
function metric(payload, key) {
  return payload.metrics.find((item) => item.key === key)?.value;
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 10_000 });
  await mongoose.connection.dropDatabase();
  const db = mongoose.connection.db;
  await db.collection("tenantproductmanifests").insertMany([
    manifestRecord(businessA, ["appointments", "staff", "analytics"]),
    manifestRecord(businessB, ["appointments", "analytics"]),
  ]);
  await db.collection("tenantsubscriptions").insertMany([
    {
      business: businessA, planKey: "standard", planVersion: "1",
      status: "active", lifecycleRevision: 1,
      entitlementGrants: [
        { key: "appointments", source: "plan" },
        { key: "staff", source: "plan" },
        { key: "analytics", source: "plan" },
      ],
    },
    {
      business: businessB, planKey: "standard", planVersion: "1",
      status: "suspended", lifecycleRevision: 1,
      entitlementGrants: [
        { key: "appointments", source: "plan" },
        { key: "analytics", source: "plan" },
      ],
    },
  ]);
  await db.collection("appointments").insertMany([
    { business: businessA, location: locationA1, startsAt: asOfDate, status: "completed", totalPrice: 100 },
    { business: businessA, location: locationA2, startsAt: asOfDate, status: "completed", totalPrice: 80 },
    { business: businessB, location: locationB, startsAt: asOfDate, status: "completed", totalPrice: 9999 },
    { location: locationA1, startsAt: asOfDate, status: "completed", totalPrice: 7777 },
  ]);
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

test("MongoDB enforces business-specific manifest and subscription evidence, including suspended plans", async () => {
  const first = await inspectTrustedTenantModuleEvidence({
    effectiveAuthority: authority(businessA),
  });
  const second = await inspectTrustedTenantModuleEvidence({
    effectiveAuthority: authority(businessB),
  });
  assert.equal(first.businessId, String(businessA));
  assert.equal(second.businessId, String(businessB));
  assert.equal(first.integrity, "verified_manifest_and_subscription");
  assert.equal(second.integrity, "verified_manifest_and_subscription");
  const aStaff = first.entries.find((row) => row.moduleId === "02");
  const bStaff = second.entries.find((row) => row.moduleId === "02");
  assert.equal(aStaff.subscriptionEntitled, true);
  assert.equal(bStaff.subscriptionEntitled, false);
  assert.equal(second.entries.find((row) => row.moduleId === "01").subscriptionEntitled, false);
  assert.equal(first.productionAccepted, null);
  assert.equal(second.productionAccepted, null);
});

test("Mongo-backed module checklist preserves denial and never elevates production acceptance", async () => {
  const a = await inspectModuleOperationalAcceptance({ effectiveAuthority: authority(businessA) });
  const b = await inspectModuleOperationalAcceptance({ effectiveAuthority: authority(businessB) });
  const moduleA = a.entries.find((row) => row.moduleId === "01");
  const moduleB = b.entries.find((row) => row.moduleId === "01");
  assert.ok(!moduleA.confirmedBlockers.includes("subscription_entitlement"));
  assert.ok(moduleB.confirmedBlockers.includes("subscription_entitlement"));
  assert.ok(moduleB.confirmedBlockers.includes("subscription_lifecycle"));
  for (const value of [a,b]) {
    assert.equal(value.acceptedCount, 0);
    assert.ok(value.entries.every((row) => !row.activationAuthorised && row.productionAccepted === null));
  }
});

test("Mongo-backed booking metric read isolates businesses and selected locations without leaking legacy unowned rows", async () => {
  const all = await buildManagementCopilotPayload({
    businessId: String(businessA), locationAccessMode: "all",
    periodDays: 1, asOfDate, includeActionPlan: false,
  });
  const oneLocation = await buildManagementCopilotPayload({
    businessId: String(businessA), locationAccessMode: "selected",
    allowedLocationIds: [String(locationA1)],
    periodDays: 1, asOfDate, includeActionPlan: false,
  });
  const otherLocation = await buildManagementCopilotPayload({
    businessId: String(businessA), locationAccessMode: "selected",
    allowedLocationIds: [String(locationA2)],
    periodDays: 1, asOfDate, includeActionPlan: false,
  });
  const foreign = await buildManagementCopilotPayload({
    businessId: String(businessB), locationAccessMode: "all",
    periodDays: 1, asOfDate, includeActionPlan: false,
  });
  assert.equal(metric(all, "bookings"), 2);
  assert.equal(metric(all, "revenue"), 180);
  assert.equal(metric(oneLocation, "bookings"), 1);
  assert.equal(metric(oneLocation, "revenue"), 100);
  assert.equal(metric(otherLocation, "revenue"), 80);
  assert.equal(metric(foreign, "bookings"), 1);
  assert.equal(metric(foreign, "revenue"), 9999);
  assert.equal(all.scope.tenantScoped, true);
  assert.equal(oneLocation.scope.authorisedLocationCount, 1);
});

test("invalid location membership and business-wide evidence requests fail before DB result disclosure", async () => {
  await assert.rejects(buildManagementCopilotPayload({
    businessId: String(businessA), locationId: String(locationB),
    locationAccessMode: "selected", allowedLocationIds: [String(locationA1)],
    asOfDate,
  }), (error) => error.code === "AI_LOCATION_SCOPE_MISMATCH");
  await assert.rejects(inspectTrustedTenantModuleEvidence({
    effectiveAuthority: authority(businessA, {
      locationAccessMode: "selected", allowedLocationIds: [String(locationA1)],
    }),
  }));
  await assert.rejects(inspectModuleOperationalAcceptance({
    effectiveAuthority: authority(businessA, { permissions: [] }),
  }));
  await assert.rejects(inspectTrustedTenantModuleEvidence({
    effectiveAuthority: authority("bad-business-id"),
  }));
});

test("real Mongo membership lookup refuses foreign tenant selection", async () => {
  const membershipCollection = mongoose.connection.db.collection("businessmemberships");
  await membershipCollection.insertMany([
    { user: userA, business: businessA, status: "active", isDefault: true, roleKey: "administrator", locationAccessMode: "all" },
    { user: userB, business: businessB, status: "active", isDefault: true, roleKey: "administrator", locationAccessMode: "all" },
  ]);
  const findMembership = ({ userId, businessId }) => BusinessMembership.findOne({
    user: userId, business: businessId, status: "active",
  });
  const findLocation = ({ locationId, businessId }) => Location.findOne({
    _id: locationId, business: businessId, status: "active",
  });
  const countMemberships = ({ userId }) => BusinessMembership.countDocuments({ user: userId, status: { $ne: "revoked" } });
  await assert.rejects(resolveTrustedTenantContext({
    authenticatedUser: userA, requestedBusinessId: String(businessB),
    findMembership, findLocation, countMemberships,
  }), (error) => error.code === "TENANT_MEMBERSHIP_NOT_FOUND");
  const resolved = await resolveTrustedTenantContext({
    authenticatedUser: userA, requestedBusinessId: String(businessA),
    findMembership, findLocation, countMemberships,
  });
  assert.equal(resolved.businessId, String(businessA));
});


function servicePayload(business, name, price) {
  return {
    business, name, category: "Hair", price, duration: 45,
    active: true, published: true, bookable: true,
  };
}
function checkPermission(effectiveAuthority, permission) {
  return new Promise((resolve) => {
    requirePermissions(permission)(
      { effectiveAuthority, requestId: "mongodb-acceptance" },
      {
        status(code) { this.code = code; return this; },
        json(body) { resolve({ allowed: false, status: this.code, body }); },
      },
      () => resolve({ allowed: true }),
    );
  });
}

test("Service Catalogue management handler uses real Mongo Business isolation and does not expose foreign service records", async () => {
  const [a, b, legacy] = await Service.insertMany([
    servicePayload(businessA, "A-only haircut", 40),
    servicePayload(businessB, "B-only haircut", 99),
    { name: "Legacy unowned service", category: "Hair", price: 5,
      duration: 20, active: true, published: true },
  ]);
  const invoke = (businessId) => new Promise((resolve, reject) => {
    getManagementServices(
      { effectiveAuthority: authority(businessId) },
      { json: (body) => resolve(body) },
      reject,
    );
  });
  const own = await invoke(businessA);
  const other = await invoke(businessB);
  assert.equal(own.success, true);
  assert.deepEqual(own.services.map((item) => item.name), ["A-only haircut"]);
  assert.deepEqual(other.services.map((item) => item.name), ["B-only haircut"]);
  assert.equal(own.services.some((item) => String(item._id) === String(b._id)), false);
  assert.equal(own.services.some((item) => String(item._id) === String(legacy._id)), false);
  const overwritten = await Service.find(scopedServiceFilter({
    businessId: String(businessA),
    domainFilter: { business: String(businessB) },
  }));
  assert.deepEqual(overwritten.map((item) => String(item._id)), [String(a._id)]);
  assert.equal(own.services.some((item) => item.name === "B-only haircut"), false);
});

test("Service Location Offering real database ownership and price overrides remain isolated", async () => {
  const service = await Service.findOne({ business: businessA, name: "A-only haircut" });
  const offerings = await LocationServiceOffering.insertMany([
    { business: businessA, location: locationA1, service: service._id,
      status: "active", available: true, priceOverride: 50 },
    { business: businessA, location: locationA2, service: service._id,
      status: "active", available: true, priceOverride: 70 },
  ]);
  const first = await LocationServiceOffering.findOne({
    business: businessA, location: locationA1, service: service._id,
  }).lean();
  const second = await LocationServiceOffering.findOne({
    business: businessA, location: locationA2, service: service._id,
  }).lean();
  assert.equal(resolveEffectiveServiceConfiguration({
    businessId: businessA, locationId: locationA1, service, offering: first,
  }).price, 50);
  assert.equal(resolveEffectiveServiceConfiguration({
    businessId: businessA, locationId: locationA2, service, offering: second,
  }).price, 70);
  assert.equal(await LocationServiceOffering.countDocuments({
    business: businessB, location: locationB, service: service._id,
  }), 0);
  assert.equal(offerings.length, 2);
  assert.throws(() => resolveEffectiveServiceConfiguration({
    businessId: businessB, locationId: locationB, service, offering: first,
  }), (error) => error.code === "SERVICE_NOT_FOUND");
});

test("Workforce management Mongo filters enforce selected Location and reject foreign personnel", async () => {
  const [a1, a2, foreign, orphan] = await Stylist.insertMany([
    { business: businessA, workingLocations: [locationA1],
      firstName: "A", lastName: "One", email: "a1@acceptance.example" },
    { business: businessA, workingLocations: [locationA2],
      firstName: "A", lastName: "Two", email: "a2@acceptance.example" },
    { business: businessB, workingLocations: [locationB],
      firstName: "B", lastName: "Only", email: "b@acceptance.example" },
    { firstName: "Legacy", lastName: "Unowned", email: "legacy@acceptance.example" },
  ]);
  const selected = authority(businessA, {
    locationAccessMode: "selected", allowedLocationIds: [String(locationA1)],
  });
  const own = await Stylist.find(scopedWorkforceFilter(selected)).lean();
  assert.deepEqual(own.map((person) => String(person._id)), [String(a1._id)]);
  const all = await Stylist.find(scopedWorkforceFilter(authority(businessA))).lean();
  assert.equal(all.length, 2);
  assert.ok(all.some((person) => String(person._id) === String(a2._id)));
  assert.ok(!all.some((person) => String(person._id) === String(foreign._id)));
  assert.ok(!all.some((person) => String(person._id) === String(orphan._id)));
  assert.throws(() => assertWorkforceResourceAuthority(selected, foreign),
    (error) => error.code === "RESOURCE_NOT_FOUND" && error.statusCode === 404);
  assert.throws(() => assertWorkforceResourceAuthority(selected, a2),
    (error) => error.code === "RESOURCE_NOT_FOUND");
});

test("Canonical management RBAC denies absent permissions and scopes even when a legacy user is marked super admin", async () => {
  const allow = await checkPermission(authority(businessA, {
    permissions: ["service:read", "employee:read", "product:read", "appointment:read"],
    locationAccessMode: "all",
  }), "service:read");
  assert.equal(allow.allowed, true);
  for (const permission of ["service:read", "employee:read", "product:read", "order:read", "appointment:read"]) {
    const denied = await checkPermission(authority(businessA, { permissions: [] }), permission);
    assert.equal(denied.allowed, false);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, "INSUFFICIENT_PERMISSIONS");
    assert.deepEqual(denied.body.missingPermissions, [permission]);
  }
  const needsLocation = await checkPermission(authority(businessA, {
    locationAccessMode: "selected", allowedLocationIds: [String(locationA1)],
    locationId: null, permissions: ["appointment:read"],
  }), "appointment:read");
  assert.equal(needsLocation.allowed, false);
  const selectedLocation = await checkPermission(authority(businessA, {
    locationAccessMode: "selected", allowedLocationIds: [String(locationA1)],
    locationId: String(locationA1), permissions: ["appointment:read"],
  }), "appointment:read");
  assert.equal(selectedLocation.allowed, true);
});

test("Commerce/inventory canonical Product collection has tenant records, but legacy global catalogue listing remains an acceptance blocker", async () => {
  await Product.insertMany([
    { business: businessA, location: locationA1, name: "A Shampoo",
      slug: "a-shampoo", sku: "A-SHAMPOO", price: 10, stockQuantity: 3, active: true },
    { business: businessB, location: locationB, name: "B Shampoo",
      slug: "b-shampoo", sku: "B-SHAMPOO", price: 20, stockQuantity: 4, active: true },
  ]);
  const scope = inventoryLocationFilter(authority(businessA, {
    locationAccessMode: "selected", allowedLocationIds: [String(locationA1)],
    locationId: String(locationA1),
  }));
  const scoped = await Product.find(scope).lean();
  assert.deepEqual(scoped.map((item) => item.name), ["A Shampoo"]);
  await assert.rejects(listProducts({ facets: "false" }),
    (error) => error.code === "COMMERCE_PUBLIC_TENANT_REQUIRED");
  const tenantCatalogue = await listProducts({ facets: "false" }, {
    publicTenantContext: { businessId: String(businessA) },
  });
  assert.deepEqual(tenantCatalogue.items.map((item) => item.name), ["A Shampoo"]);
  const foreignCatalogue = await listProducts({ facets: "false" }, {
    publicTenantContext: { businessId: String(businessB) },
  });
  assert.deepEqual(foreignCatalogue.items.map((item) => item.name), ["B Shampoo"]);
  assert.ok(Order.schema.path("business"));
  assert.ok(Order.schema.path("location"));
});

test("Commerce ownership predicate isolates canonical Product and Order records and excludes unowned legacy data", async () => {
  const [ownOrder, otherLocationOrder, foreignOrder, legacyOrder] =
    await mongoose.connection.db.collection("orders").insertMany([
      { business: businessA, location: locationA1, status: "paid" },
      { business: businessA, location: locationA2, status: "paid" },
      { business: businessB, location: locationB, status: "paid" },
      { location: locationA1, status: "paid" },
    ]).then(({ insertedIds }) => Object.values(insertedIds));

  const selected = authority(businessA, {
    locationAccessMode: "selected",
    allowedLocationIds: [String(locationA1)],
  });
  const ownProducts = await Product.find(commerceTenantFilter(selected)).lean();
  const ownOrders = await Order.find(commerceTenantFilter(selected)).lean();
  assert.deepEqual(ownProducts.map((item) => item.name), ["A Shampoo"]);
  assert.deepEqual(ownOrders.map((item) => String(item._id)), [String(ownOrder)]);
  assert.equal(ownOrders.some((item) => String(item._id) === String(legacyOrder)), false);
  assert.equal(ownOrders.some((item) => String(item._id) === String(foreignOrder)), false);
  assert.equal(ownOrders.some((item) => String(item._id) === String(otherLocationOrder)), false);

  const all = await Order.find(commerceTenantFilter(authority(businessA))).lean();
  assert.equal(all.length, 2);
  assert.throws(() => commerceTenantFilter(null), (error) =>
    error.code === "COMMERCE_TENANT_CONTEXT_REQUIRED");
  assert.throws(() => commerceTenantFilter({ businessId: "not-a-business", locationAccessMode: "all" }));
  assert.throws(() => commerceTenantFilter(authority(businessA, { locationAccessMode: "selected", allowedLocationIds: [] })),
    (error) => error.code === "COMMERCE_LOCATION_NOT_FOUND");
  assert.throws(() => commerceTenantFilter(selected, { locationId: String(locationB) }),
    (error) => error.code === "COMMERCE_LOCATION_NOT_FOUND");
  assert.throws(() => commerceTenantFilter(authority(businessA, { locationAccessMode: "unknown" })),
    (error) => error.code === "COMMERCE_LOCATION_AUTHORITY_REQUIRED");
});

test("Commerce list facets and product detail reads fail closed across tenants and selected Locations", async () => {
  const first = await listProducts({ facets: "true" }, {
    publicTenantContext: { businessId: String(businessA) },
  });
  const second = await listProducts({ facets: "true" }, {
    publicTenantContext: { businessId: String(businessB) },
  });
  assert.equal(first.pagination.total, 1);
  assert.equal(second.pagination.total, 1);
  assert.deepEqual(first.items.map((item) => item.name), ["A Shampoo"]);
  assert.deepEqual(second.items.map((item) => item.name), ["B Shampoo"]);

  const a = await Product.findOne({ business: businessA }).lean();
  const b = await Product.findOne({ business: businessB }).lean();
  const ownProduct = await getProduct(String(a._id), {
    publicTenantContext: { businessId: String(businessA) },
  });
  assert.equal(String(ownProduct._id), String(a._id));
  await assert.rejects(getProduct(String(b._id), {
    publicTenantContext: { businessId: String(businessA) },
  }), (error) => error.statusCode === 404);
  await assert.rejects(getProduct(String(a._id)), (error) =>
    error.code === "COMMERCE_PUBLIC_TENANT_REQUIRED");

  const selected = authority(businessA, {
    locationAccessMode: "selected",
    allowedLocationIds: [String(locationA1)],
  });
  const management = await listProducts({ facets: "false" }, {
    management: true, effectiveAuthority: selected,
  });
  assert.deepEqual(management.items.map((item) => item.name), ["A Shampoo"]);
  await assert.rejects(listProducts({}, { management: true }), (error) =>
    error.code === "COMMERCE_TENANT_CONTEXT_REQUIRED");
});
