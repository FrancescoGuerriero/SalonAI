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

test("canonical Salon tenant configuration identifies Francesco Picardi as Tenant 1", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});

  assert.deepEqual(
    configuration,
    {
      business: {
        name:
          "Francesco Picardi",
        slug:
          "francesco-picardi",
        businessType:
          "salon",
        settings: {
          timezone:
            "Europe/London",
          locale:
            "en-GB",
          currency:
            "GBP",
        },
      },
      location: {
        name:
          "Primary Location",
        slug:
          "primary-location",
      },
      domains: [
        {
          host:
            "francescopicardi.co.uk",
          role:
            "primary",
          redirectToPrimary:
            false,
        },
        {
          host:
            "salonai.francescopicardi.co.uk",
          role:
            "app-subdomain",
          redirectToPrimary:
            false,
        },
      ],
    }
  );
});

test("canonical Salon tenant bootstrap defaults to dry-run", () => {
  assert.equal(
    selectedMode([], {}),
    "dry-run"
  );

  assert.equal(
    selectedMode(
      ["--verify"],
      {}
    ),
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

test("canonical tenant bootstrap plan includes Business, Location and domains", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});

  const plan =
    buildCanonicalTenantBootstrapPlan({
      business: null,
      location: null,
      domains: [],
      configuration,
    });

  assert.equal(
    plan.business.action,
    "create"
  );
  assert.equal(
    plan.location.action,
    "create"
  );
  assert.deepEqual(
    plan.domains.map(
      (domain) => [
        domain.host,
        domain.role,
        domain.action,
      ]
    ),
    [
      [
        "francescopicardi.co.uk",
        "primary",
        "create",
      ],
      [
        "salonai.francescopicardi.co.uk",
        "app-subdomain",
        "create",
      ],
    ]
  );
  assert.equal(
    plan.writesRequired,
    true
  );
});

test("canonical tenant bootstrap plan is idempotent when all reference resources exist", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});
  const businessId =
    new mongoose.Types.ObjectId();
  const locationId =
    new mongoose.Types.ObjectId();

  const business = {
    _id:
      businessId,
    slug:
      "francesco-picardi",
    businessType:
      "salon",
  };

  const location = {
    _id:
      locationId,
    business:
      businessId,
    slug:
      "primary-location",
  };

  const domains =
    configuration.domains.map(
      (domain) => ({
        _id:
          new mongoose.Types.ObjectId(),
        business:
          businessId,
        host:
          domain.host,
        role:
          domain.role,
        status:
          "pending",
      })
    );

  const plan =
    buildCanonicalTenantBootstrapPlan({
      business,
      location,
      domains,
      configuration,
    });

  assert.equal(
    plan.business.action,
    "reuse"
  );
  assert.equal(
    plan.location.action,
    "reuse"
  );
  assert.equal(
    plan.domains.every(
      (domain) =>
        domain.action ===
        "reuse"
    ),
    true
  );
  assert.equal(
    plan.writesRequired,
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
            "francesco-picardi",
          businessType:
            "spa",
        },
        location: null,
        domains: [],
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
            "francesco-picardi",
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
        domains: [],
        configuration,
      }),
    (error) =>
      error.code ===
      "CANONICAL_LOCATION_CONFLICT"
  );
});

test("canonical tenant bootstrap refuses a domain owned by another Business", () => {
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
            "francesco-picardi",
          businessType:
            "salon",
        },
        location: null,
        domains: [
          {
            _id:
              new mongoose.Types.ObjectId(),
            business:
              new mongoose.Types.ObjectId(),
            host:
              "francescopicardi.co.uk",
            role:
              "primary",
          },
        ],
        configuration,
      }),
    (error) =>
      error.code ===
      "CANONICAL_DOMAIN_CONFLICT"
  );
});

test("canonical tenant bootstrap rejects identical primary and app domains", () => {
  assert.throws(
    () =>
      getCanonicalSalonTenantConfiguration({
        SALONAI_CANONICAL_PRIMARY_DOMAIN:
          "francescopicardi.co.uk",
        SALONAI_CANONICAL_APP_DOMAIN:
          "francescopicardi.co.uk",
      }),
    (error) =>
      error.code ===
      "CANONICAL_DOMAIN_CONFLICT"
  );
});
