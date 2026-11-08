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
