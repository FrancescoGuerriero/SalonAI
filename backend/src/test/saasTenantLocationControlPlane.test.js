import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import BusinessMembership from "../models/BusinessMembership.js";
import Location from "../models/Location.js";
import {
  assertMembershipGrantsBusiness,
  assertMembershipGrantsLocation,
  trustedTenantContext,
} from "../platform/tenancy/trustedTenantContext.js";
import {
  resolveEffectiveConfiguration,
} from "../platform/configuration/configurationInheritance.js";

test("BusinessMembership binds one user to one business with fail-closed location scope", () => {
  const membership = new BusinessMembership({
    user: new mongoose.Types.ObjectId(),
    business: new mongoose.Types.ObjectId(),
    roleKey: "manager",
  });

  assert.equal(membership.status, "active");
  assert.equal(membership.locationAccessMode, "selected");
  assert.deepEqual(membership.locations, []);
  assert.equal(membership.validateSync(), undefined);

  const uniqueIndex = BusinessMembership.schema.indexes().find(
    ([fields, options]) =>
      fields.user === 1 &&
      fields.business === 1 &&
      options.unique === true
  );

  assert.ok(uniqueIndex);
});

test("BusinessMembership clears location ids when access mode is all", async () => {
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

  assert.deepEqual(membership.locations, []);
});

test("Location belongs to a business and uses tenant-local slug uniqueness", () => {
  const businessId = new mongoose.Types.ObjectId();

  const location = new Location({
    business: businessId,
    name: "Marylebone",
    slug: "marylebone",
    hierarchy: {
      regionKey: "london",
      zoneKey: "central",
    },
    settings: {
      timezone: "Europe/London",
      currency: "GBP",
    },
  });

  assert.equal(location.status, "active");
  assert.equal(location.validateSync(), undefined);

  const uniqueIndex = Location.schema.indexes().find(
    ([fields, options]) =>
      fields.business === 1 &&
      fields.slug === 1 &&
      options.unique === true
  );

  assert.ok(uniqueIndex);
});

test("trusted business context rejects inactive or cross-tenant memberships", () => {
  const userId = new mongoose.Types.ObjectId();
  const businessId = new mongoose.Types.ObjectId();
  const otherBusinessId = new mongoose.Types.ObjectId();

  const membership = {
    user: userId,
    business: businessId,
    status: "active",
    roleKey: "manager",
    locationAccessMode: "all",
    locations: [],
  };

  assert.equal(
    assertMembershipGrantsBusiness({
      membership,
      userId,
      businessId,
    }),
    membership
  );

  assert.throws(
    () =>
      assertMembershipGrantsBusiness({
        membership,
        userId,
        businessId: otherBusinessId,
      }),
    (error) =>
      error.code === "TENANT_MEMBERSHIP_NOT_FOUND" &&
      error.statusCode === 404
  );

  assert.throws(
    () =>
      assertMembershipGrantsBusiness({
        membership: {
          ...membership,
          status: "suspended",
        },
        userId,
        businessId,
      }),
    (error) => error.code === "TENANT_MEMBERSHIP_NOT_FOUND"
  );
});

test("selected location access fails closed outside the membership scope", () => {
  const userId = new mongoose.Types.ObjectId();
  const businessId = new mongoose.Types.ObjectId();
  const allowedLocationId = new mongoose.Types.ObjectId();
  const deniedLocationId = new mongoose.Types.ObjectId();

  const membership = {
    user: userId,
    business: businessId,
    status: "active",
    roleKey: "receptionist",
    locationAccessMode: "selected",
    locations: [allowedLocationId],
  };

  const allowed = {
    _id: allowedLocationId,
    business: businessId,
  };

  const denied = {
    _id: deniedLocationId,
    business: businessId,
  };

  assert.equal(
    assertMembershipGrantsLocation({
      membership,
      location: allowed,
    }),
    allowed
  );

  assert.throws(
    () =>
      assertMembershipGrantsLocation({
        membership,
        location: denied,
      }),
    (error) =>
      error.code === "TENANT_LOCATION_NOT_FOUND" &&
      error.statusCode === 404
  );

  assert.deepEqual(
    trustedTenantContext({
      membership,
      userId,
      businessId,
      location: allowed,
    }),
    {
      userId: String(userId),
      businessId: String(businessId),
      locationId: String(allowedLocationId),
      roleKey: "receptionist",
      locationAccessMode: "selected",
      allowedLocationIds: [
        String(allowedLocationId),
      ],
    }
  );
});

test("configuration inheritance records provenance and honours locks", () => {
  const resolved = resolveEffectiveConfiguration([
    {
      scope: "platform",
      values: {
        locale: "en-GB",
        payments: {
          rawCardStorage: false,
        },
      },
      locks: [
        "payments.rawCardStorage",
      ],
    },
    {
      scope: "vertical:salon",
      values: {
        terminology: {
          staffMember: "Stylist",
        },
      },
    },
    {
      scope: "business:example",
      values: {
        locale: "fr-FR",
        payments: {
          rawCardStorage: true,
        },
      },
    },
    {
      scope: "location:central",
      values: {
        timezone: "Europe/London",
      },
    },
  ]);

  assert.deepEqual(resolved.value, {
    locale: "fr-FR",
    payments: {
      rawCardStorage: false,
    },
    terminology: {
      staffMember: "Stylist",
    },
    timezone: "Europe/London",
  });

  assert.equal(resolved.provenance.locale, "business:example");
  assert.equal(
    resolved.provenance["payments.rawCardStorage"],
    "platform"
  );
  assert.equal(
    resolved.provenance["terminology.staffMember"],
    "vertical:salon"
  );
  assert.equal(
    resolved.provenance.timezone,
    "location:central"
  );
  assert.equal(
    resolved.locks["payments.rawCardStorage"],
    "platform"
  );
});
