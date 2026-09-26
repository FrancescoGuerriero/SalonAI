import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import BusinessMembership from "../models/BusinessMembership.js";
import Location from "../models/Location.js";
import {
  resolveTrustedTenantContext,
} from "../platform/tenancy/trustedTenantContext.js";
import {
  createTrustedTenantContextMiddleware,
} from "../platform/tenancy/trustedTenantMiddleware.js";
import {
  resolveEffectiveConfiguration,
} from "../platform/configuration/configurationInheritance.js";

test("BusinessMembership enforces one active default membership contract", () => {
  const indexes = BusinessMembership.schema.indexes();

  const defaultIndex = indexes.find(
    ([fields]) =>
      fields.user === 1 &&
      fields.isDefault === 1
  );

  assert.ok(defaultIndex);
  assert.equal(defaultIndex[1].unique, true);
  assert.deepEqual(
    defaultIndex[1].partialFilterExpression,
    {
      isDefault: true,
      status: "active",
    }
  );
});

test("BusinessMembership all-location access clears selected location ids", async () => {
  const membership = new BusinessMembership({
    user: new mongoose.Types.ObjectId(),
    business: new mongoose.Types.ObjectId(),
    roleKey: "admin",
    locationAccessMode: "all",
    locations: [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
    ],
  });

  await membership.validate();
  assert.equal(membership.locations.length, 0);
});

test("Location uses business-local slug uniqueness", () => {
  const indexes = Location.schema.indexes();

  const scopedSlug = indexes.find(
    ([fields]) =>
      fields.business === 1 &&
      fields.slug === 1
  );

  assert.ok(scopedSlug);
  assert.equal(scopedSlug[1].unique, true);

  const location = new Location({
    business: new mongoose.Types.ObjectId(),
    name: "Marylebone",
    slug: "marylebone",
    settings: {
      timezone: "Europe/London",
      locale: "en-GB",
      currency: "GBP",
    },
  });

  assert.equal(location.validateSync(), undefined);
});

test("trusted tenant resolution treats client ids as selectors, not authority", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const businessA = new mongoose.Types.ObjectId().toString();
  const businessB = new mongoose.Types.ObjectId().toString();
  const locationA = new mongoose.Types.ObjectId().toString();
  const locationB = new mongoose.Types.ObjectId().toString();

  const membershipA = {
    _id: new mongoose.Types.ObjectId(),
    user: userId,
    business: businessA,
    status: "active",
    roleKey: "admin",
    locationAccessMode: "selected",
    locations: [locationA],
    isDefault: true,
  };

  const findMembership = async ({ userId: candidateUser, businessId }) => {
    if (
      candidateUser === userId &&
      (!businessId || businessId === businessA)
    ) {
      return membershipA;
    }

    return null;
  };

  const findLocation = async ({ locationId, businessId }) => {
    if (locationId === locationA && businessId === businessA) {
      return {
        _id: locationA,
        business: businessA,
        status: "active",
      };
    }

    if (locationId === locationB) {
      return {
        _id: locationB,
        business: businessB,
        status: "active",
      };
    }

    return null;
  };

  const context = await resolveTrustedTenantContext({
    authenticatedUser: {
      _id: userId,
    },
    requestedBusinessId: businessA,
    requestedLocationId: locationA,
    findMembership,
    findLocation,
  });

  assert.deepEqual(context, {
    userId,
    businessId: businessA,
    locationId: locationA,
    roleKey: "admin",
    locationAccessMode: "selected",
    allowedLocationIds: [
      locationA,
    ],
  });

  await assert.rejects(
    resolveTrustedTenantContext({
      authenticatedUser: {
        _id: userId,
      },
      requestedBusinessId: businessB,
      findMembership,
      findLocation,
    }),
    (error) =>
      error.code === "TENANT_MEMBERSHIP_NOT_FOUND" &&
      error.statusCode === 404
  );

  await assert.rejects(
    resolveTrustedTenantContext({
      authenticatedUser: {
        _id: userId,
      },
      requestedBusinessId: businessA,
      requestedLocationId: locationB,
      findMembership,
      findLocation,
    }),
    (error) =>
      error.code === "TENANT_LOCATION_NOT_FOUND" &&
      error.statusCode === 404
  );
});

test("trusted tenant resolution can use an explicit active default membership", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const businessId = new mongoose.Types.ObjectId().toString();

  const membership = {
    user: userId,
    business: businessId,
    status: "active",
    roleKey: "manager",
    locationAccessMode: "all",
    locations: [],
    isDefault: true,
  };

  const context = await resolveTrustedTenantContext({
    authenticatedUser: {
      _id: userId,
    },
    findMembership: async ({ userId: candidateUser, businessId: selector }) => {
      assert.equal(candidateUser, userId);
      assert.equal(selector, null);
      return membership;
    },
    findLocation: async () => null,
  });

  assert.equal(context.businessId, businessId);
  assert.equal(context.locationId, null);
  assert.equal(context.roleKey, "manager");
  assert.equal(context.locationAccessMode, "all");
  assert.equal(context.allowedLocationIds, null);
});

test("configuration inheritance records provenance, locks, entitlements and revisions", () => {
  const result = resolveEffectiveConfiguration(
    [
      {
        scope: "platform",
        revision: "platform-1",
        values: {
          booking: {
            enabled: true,
            leadMinutes: 60,
          },
          ai: {
            enabled: false,
          },
        },
        locks: [
          "booking.enabled",
        ],
      },
      {
        scope: "vertical:salon",
        revision: "salon-3",
        values: {
          booking: {
            enabled: false,
            leadMinutes: 45,
          },
        },
      },
      {
        scope: "business",
        revision: "business-7",
        allowedPaths: [
          "booking.leadMinutes",
          "ai.enabled",
        ],
        requiredEntitlements: {
          "ai.enabled": [
            "ai-tools",
          ],
        },
        values: {
          booking: {
            leadMinutes: 30,
          },
          ai: {
            enabled: true,
          },
          security: {
            allowPublicAdmin: true,
          },
        },
      },
      {
        scope: "location",
        revision: "location-2",
        allowedPaths: [
          "booking.leadMinutes",
        ],
        values: {
          booking: {
            leadMinutes: 15,
          },
        },
      },
    ],
    {
      entitlements: [],
    }
  );

  assert.equal(result.value.booking.enabled, true);
  assert.equal(result.value.booking.leadMinutes, 15);
  assert.equal(result.value.ai.enabled, false);
  assert.equal(result.provenance["booking.enabled"], "platform");
  assert.equal(result.provenance["booking.leadMinutes"], "location");

  assert.ok(
    result.blockedOverrides.some(
      (item) =>
        item.path === "booking.enabled" &&
        item.reason === "locked" &&
        item.lockedBy === "platform"
    )
  );

  assert.ok(
    result.blockedOverrides.some(
      (item) =>
        item.path === "ai.enabled" &&
        item.reason === "missing-entitlement"
    )
  );

  assert.ok(
    result.blockedOverrides.some(
      (item) =>
        item.path === "security.allowPublicAdmin" &&
        item.reason === "override-not-permitted"
    )
  );

  assert.deepEqual(result.revisions, [
    {
      scope: "platform",
      revision: "platform-1",
    },
    {
      scope: "vertical:salon",
      revision: "salon-3",
    },
    {
      scope: "business",
      revision: "business-7",
    },
    {
      scope: "location",
      revision: "location-2",
    },
  ]);
});

test("configuration entitlement permits a governed override when available", () => {
  const result = resolveEffectiveConfiguration(
    [
      {
        scope: "platform",
        values: {
          ai: {
            enabled: false,
          },
        },
      },
      {
        scope: "business",
        allowedPaths: [
          "ai.enabled",
        ],
        requiredEntitlements: {
          "ai.enabled": "ai-tools",
        },
        values: {
          ai: {
            enabled: true,
          },
        },
      },
    ],
    {
      entitlements: [
        "ai-tools",
      ],
    }
  );

  assert.equal(result.value.ai.enabled, true);
  assert.equal(result.provenance["ai.enabled"], "business");
  assert.equal(result.blockedOverrides.length, 0);
});


test("trusted tenant middleware ignores raw client tenant fields by default", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const spoofedBusinessId = new mongoose.Types.ObjectId().toString();
  const spoofedLocationId = new mongoose.Types.ObjectId().toString();

  const calls = [];
  const middleware = createTrustedTenantContextMiddleware({
    contextResolver: async (input) => {
      calls.push(input);
      return Object.freeze({
        userId,
        businessId: "trusted-business",
        locationId: null,
        roleKey: "admin",
        locationAccessMode: "all",
        allowedLocationIds: null,
      });
    },
  });

  const request = {
    user: {
      _id: userId,
    },
    headers: {
      "x-business-id": spoofedBusinessId,
      "x-location-id": spoofedLocationId,
    },
    query: {
      businessId: spoofedBusinessId,
      locationId: spoofedLocationId,
    },
    body: {
      businessId: spoofedBusinessId,
      locationId: spoofedLocationId,
    },
  };

  let nextError = null;

  await middleware(
    request,
    {},
    (error) => {
      nextError = error || null;
    }
  );

  assert.equal(nextError, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].requestedBusinessId, null);
  assert.equal(calls[0].requestedLocationId, null);
  assert.equal(request.tenantContext.businessId, "trusted-business");
});

test("trusted tenant middleware consumes only server-approved selection", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const businessId = new mongoose.Types.ObjectId().toString();
  const locationId = new mongoose.Types.ObjectId().toString();

  const calls = [];
  const middleware = createTrustedTenantContextMiddleware({
    contextResolver: async (input) => {
      calls.push(input);
      return Object.freeze({
        userId,
        businessId,
        locationId,
        roleKey: "manager",
        locationAccessMode: "selected",
        allowedLocationIds: [
          locationId,
        ],
      });
    },
  });

  const request = {
    user: {
      _id: userId,
    },
    trustedTenantSelection: {
      businessId,
      locationId,
    },
    headers: {
      "x-business-id": new mongoose.Types.ObjectId().toString(),
    },
  };

  let nextError = null;

  await middleware(
    request,
    {},
    (error) => {
      nextError = error || null;
    }
  );

  assert.equal(nextError, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].requestedBusinessId, businessId);
  assert.equal(calls[0].requestedLocationId, locationId);
  assert.equal(request.tenantContext.locationId, locationId);
});

test("trusted tenant middleware fails closed before authentication", async () => {
  const middleware = createTrustedTenantContextMiddleware({
    contextResolver: async () => {
      throw new Error("context resolver should not be called");
    },
  });

  let nextError = null;

  await middleware(
    {},
    {},
    (error) => {
      nextError = error || null;
    }
  );

  assert.ok(nextError);
  assert.equal(nextError.statusCode, 401);
  assert.equal(
    nextError.code,
    "TRUSTED_TENANT_CONTEXT_REQUIRED"
  );
});


test("configuration locks cannot be bypassed by replacing a locked descendant parent", () => {
  const result = resolveEffectiveConfiguration([
    {
      scope: "platform",
      values: {
        payments: {
          rawCardStorage: false,
          captureMode: "provider",
        },
      },
      locks: [
        "payments.rawCardStorage",
      ],
    },
    {
      scope: "business",
      values: {
        payments: false,
      },
    },
  ]);

  assert.deepEqual(result.value.payments, {
    rawCardStorage: false,
    captureMode: "provider",
  });

  assert.ok(
    result.blockedOverrides.some(
      (item) =>
        item.path === "payments" &&
        item.reason === "locked" &&
        item.lockedPath === "payments.rawCardStorage" &&
        item.lockedBy === "platform"
    )
  );
});
