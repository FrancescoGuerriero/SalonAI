import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  assertExplicitCanonicalTenantIdentity,
  buildCanonicalTenantBootstrapPlan,
  getCanonicalSalonTenantConfiguration,
} from "../platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  createMissingResources,
  selectedMode,
} from "../../scripts/bootstrapCanonicalSalonTenant.js";

function explicitIdentity() {
  return {
    SALONAI_CANONICAL_BUSINESS_NAME:
      "Francesco Picardi",
    SALONAI_CANONICAL_BUSINESS_SLUG:
      "francesco-picardi",
    SALONAI_CANONICAL_LOCATION_NAME:
      "Primary Location",
    SALONAI_CANONICAL_LOCATION_SLUG:
      "primary-location",
    SALONAI_CANONICAL_PRIMARY_DOMAIN:
      "francescopicardi.co.uk",
    SALONAI_CANONICAL_APP_DOMAIN:
      "salonai.francescopicardi.co.uk",
  };
}

test("canonical Salon tenant configuration identifies Francesco Picardi as Tenant 1", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});

  assert.deepEqual(configuration, {
    business: {
      name: "Francesco Picardi",
      slug: "francesco-picardi",
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
    domains: [
      {
        host: "francescopicardi.co.uk",
        role: "primary",
        redirectToPrimary: false,
      },
      {
        host: "salonai.francescopicardi.co.uk",
        role: "app-subdomain",
        redirectToPrimary: false,
      },
    ],
  });
});

test("canonical Salon tenant bootstrap defaults to dry-run", () => {
  assert.equal(selectedMode([], {}), "dry-run");
  assert.equal(selectedMode(["--verify"], {}), "verify");

  assert.throws(
    () => selectedMode(["--apply"], {}),
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

test("canonical tenant apply identity must be explicitly operator configured including domains", () => {
  assert.throws(
    () => assertExplicitCanonicalTenantIdentity({}),
    (error) =>
      error.code ===
      "CANONICAL_TENANT_IDENTITY_REQUIRED"
  );

  const incomplete = explicitIdentity();
  delete incomplete.SALONAI_CANONICAL_APP_DOMAIN;

  assert.throws(
    () =>
      assertExplicitCanonicalTenantIdentity(
        incomplete
      ),
    /SALONAI_CANONICAL_APP_DOMAIN/
  );

  assert.equal(
    assertExplicitCanonicalTenantIdentity(
      explicitIdentity()
    ),
    true
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

  assert.equal(plan.business.action, "create");
  assert.equal(plan.location.action, "create");
  assert.deepEqual(
    plan.domains.map((domain) => [
      domain.host,
      domain.role,
      domain.action,
    ]),
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
  assert.equal(plan.writesRequired, true);
});

test("canonical tenant bootstrap plan is idempotent when all reference resources exist", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});
  const businessId =
    new mongoose.Types.ObjectId();
  const locationId =
    new mongoose.Types.ObjectId();

  const business = {
    _id: businessId,
    name: "Francesco Picardi",
    slug: "francesco-picardi",
    businessType: "salon",
  };

  const location = {
    _id: locationId,
    business: businessId,
    name: "Primary Location",
    slug: "primary-location",
  };

  const domains =
    configuration.domains.map((domain) => ({
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
    }));

  const plan =
    buildCanonicalTenantBootstrapPlan({
      business,
      location,
      domains,
      configuration,
    });

  assert.equal(plan.business.action, "reuse");
  assert.equal(plan.location.action, "reuse");
  assert.equal(
    plan.domains.every(
      (domain) =>
        domain.action === "reuse"
    ),
    true
  );
  assert.equal(plan.writesRequired, false);
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
          name:
            "Francesco Picardi",
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

test("canonical tenant bootstrap refuses a same-slug business with a different name", () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});

  assert.throws(
    () =>
      buildCanonicalTenantBootstrapPlan({
        business: {
          _id:
            new mongoose.Types.ObjectId(),
          name:
            "Different Business",
          slug:
            "francesco-picardi",
          businessType:
            "salon",
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
          name:
            "Francesco Picardi",
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
          name:
            "Primary Location",
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

test("canonical tenant bootstrap refuses a same-slug location with a different name", () => {
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
          name:
            "Francesco Picardi",
          slug:
            "francesco-picardi",
          businessType:
            "salon",
        },
        location: {
          _id:
            new mongoose.Types.ObjectId(),
          business:
            businessId,
          name:
            "Different Location",
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
          name:
            "Francesco Picardi",
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


test("canonical tenant transaction rebuilds attempt-local state when withTransaction retries", async () => {
  const configuration =
    getCanonicalSalonTenantConfiguration({});

  const businessIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];
  const businessCreateOwners = [];
  const locationCreateOwners = [];
  const domainCreateOwners = [];
  let businessCreateCalls = 0;
  let locationCreateCalls = 0;
  let endSessionCalls = 0;

  const fakeBusiness = {
    async create() {
      const id = businessIds[businessCreateCalls];
      businessCreateCalls += 1;
      businessCreateOwners.push(String(id));
      return [{ _id: id }];
    },
  };

  const fakeLocation = {
    async create(records) {
      locationCreateCalls += 1;
      locationCreateOwners.push(String(records[0].business));

      if (locationCreateCalls === 1) {
        const error = new Error("simulated transient transaction retry");
        error.code = "SIMULATED_TRANSIENT_TRANSACTION";
        throw error;
      }

      return [{
        _id: new mongoose.Types.ObjectId(),
        business: records[0].business,
      }];
    },
  };

  const fakeBusinessDomain = {
    async create(records) {
      domainCreateOwners.push(String(records[0].business));
      return [{
        _id: new mongoose.Types.ObjectId(),
        business: records[0].business,
        host: records[0].host,
      }];
    },
  };

  const fakeSession = {
    async withTransaction(callback) {
      try {
        await callback();
      } catch (error) {
        assert.equal(
          error.code,
          "SIMULATED_TRANSIENT_TRANSACTION"
        );
        await callback();
      }
    },
    async endSession() {
      endSessionCalls += 1;
    },
  };

  const result = await createMissingResources({
    configuration,
    business: null,
    location: null,
    domains: [],
    dependencies: {
      Business: fakeBusiness,
      Location: fakeLocation,
      BusinessDomain: fakeBusinessDomain,
      startSession: async () => fakeSession,
    },
  });

  assert.equal(businessCreateCalls, 2);
  assert.equal(locationCreateCalls, 2);
  assert.equal(endSessionCalls, 1);

  assert.equal(
    String(result.business._id),
    String(businessIds[1])
  );
  assert.equal(
    String(result.location.business),
    String(businessIds[1])
  );
  assert.deepEqual(
    domainCreateOwners,
    [
      String(businessIds[1]),
      String(businessIds[1]),
    ]
  );

  assert.deepEqual(
    locationCreateOwners,
    [
      String(businessIds[0]),
      String(businessIds[1]),
    ]
  );
  assert.deepEqual(
    businessCreateOwners,
    [
      String(businessIds[0]),
      String(businessIds[1]),
    ]
  );
});
