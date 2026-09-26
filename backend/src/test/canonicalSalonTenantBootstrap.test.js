import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  buildCanonicalTenantBootstrapPlan,
  getCanonicalSalonTenantConfiguration,
} from "../platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  selectedMode,
} from "../../scripts/bootstrapCanonicalSalonTenant.js";

test("canonical Salon tenant configuration has stable safe defaults", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});

  assert.deepEqual(configuration, {
    business: {
      name: "Salon AI",
      slug: "salon-ai",
      businessType: "salon",
      settings: {
        timezone: "Europe/London",
        locale: "en-GB",
        currency: "GBP",
      },
    },
    location: {
      name: "Primary Location",
      slug: "primary-location",
    },
  });
});

test("canonical Salon tenant bootstrap defaults to dry-run", () => {
  assert.equal(
    selectedMode([], {}),
    "dry-run"
  );

  assert.equal(
    selectedMode(["--verify"], {}),
    "verify"
  );

  assert.throws(
    () =>
      selectedMode(
        ["--apply"],
        {}
      ),
    /SALONAI_TENANT_BOOTSTRAP_CONFIRM/
  );

  assert.equal(
    selectedMode(
      ["--apply"],
      {
        SALONAI_TENANT_BOOTSTRAP_CONFIRM:
          "BOOTSTRAP_CANONICAL_SALONAI_TENANT",
      }
    ),
    "apply"
  );
});

test("canonical tenant bootstrap plan is idempotent", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});
  const businessId =
    new mongoose.Types.ObjectId();
  const locationId =
    new mongoose.Types.ObjectId();

  const firstPlan =
    buildCanonicalTenantBootstrapPlan({
      business: null,
      location: null,
      configuration,
    });

  assert.equal(
    firstPlan.business.action,
    "create"
  );
  assert.equal(
    firstPlan.location.action,
    "create"
  );
  assert.equal(
    firstPlan.writesRequired,
    true
  );

  const existingBusiness = {
    _id: businessId,
    slug: "salon-ai",
    businessType: "salon",
  };

  const existingLocation = {
    _id: locationId,
    business: businessId,
    slug: "primary-location",
  };

  const secondPlan =
    buildCanonicalTenantBootstrapPlan({
      business:
        existingBusiness,
      location:
        existingLocation,
      configuration,
    });

  assert.equal(
    secondPlan.business.action,
    "reuse"
  );
  assert.equal(
    secondPlan.location.action,
    "reuse"
  );
  assert.equal(
    secondPlan.writesRequired,
    false
  );
});

test("canonical tenant bootstrap refuses a conflicting vertical", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});

  assert.throws(
    () =>
      buildCanonicalTenantBootstrapPlan({
        business: {
          _id:
            new mongoose.Types.ObjectId(),
          slug:
            "salon-ai",
          businessType:
            "spa",
        },
        location: null,
        configuration,
      }),
    (error) =>
      error.code ===
      "CANONICAL_BUSINESS_CONFLICT"
  );
});

test("canonical tenant bootstrap refuses a cross-business location", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});
  const businessId =
    new mongoose.Types.ObjectId();

  assert.throws(
    () =>
      buildCanonicalTenantBootstrapPlan({
        business: {
          _id:
            businessId,
          slug:
            "salon-ai",
          businessType:
            "salon",
        },
        location: {
          _id:
            new mongoose.Types.ObjectId(),
          business:
            new mongoose.Types.ObjectId(),
          slug:
            "primary-location",
        },
        configuration,
      }),
    (error) =>
      error.code ===
      "CANONICAL_LOCATION_CONFLICT"
  );
});
