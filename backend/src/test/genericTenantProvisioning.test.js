import assert from "node:assert/strict";
import test from "node:test";

import {
  assertTenantProvisioningApplyAuthorization,
  buildTenantProvisioningPlan,
  normaliseTenantProvisioningRequest,
} from "../platform/tenancy/genericTenantProvisioning.js";

const OWNER = "507f1f77bcf86cd799439011";
const BUSINESS = "507f1f77bcf86cd799439012";
const LOCATION = "507f1f77bcf86cd799439013";

function request(overrides = {}) {
  return {
    verticalId: "salon",
    businessName: "Tenant Two Salon",
    businessSlug: "tenant-two-salon",
    locale: "en-GB",
    timezone: "Europe/London",
    currency: "GBP",
    primaryLocation: {
      name: "Tenant Two Primary",
      slug: "tenant-two-primary",
    },
    primaryDomain: "tenant-two.example.com",
    appDomain: "app.tenant-two.example.com",
    ownerUserId: OWNER,
    productManifest: {
      status: "draft",
      capabilityPackKeys: [],
    },
    ...overrides,
  };
}

test("generic tenant provisioning creates an isolated deterministic Tenant 2 plan", () => {
  const first = buildTenantProvisioningPlan({
    request: request(),
    snapshot: {
      businesses: [{ _id: "507f1f77bcf86cd799439099", slug: "tenant-one", businessType: "salon" }],
      users: [{ _id: OWNER }],
    },
  });
  const second = buildTenantProvisioningPlan({
    request: request(),
    snapshot: {
      businesses: [{ _id: "507f1f77bcf86cd799439099", slug: "tenant-one", businessType: "salon" }],
      users: [{ _id: OWNER }],
    },
  });

  assert.equal(first.executable, true);
  assert.equal(first.writesPerformed, false);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(
    first.operations.map((operation) => operation.type),
    [
      "create-business",
      "create-location",
      "create-domain",
      "create-domain",
      "create-owner-membership",
      "create-product-manifest",
    ]
  );
  assert.equal(first.report.dnsMutation, false);
  assert.equal(first.report.sourceCodeGeneration, false);
});

test("generic tenant provisioning becomes a no-op when matching resources already exist", () => {
  const plan = buildTenantProvisioningPlan({
    request: request(),
    snapshot: {
      businesses: [{ _id: BUSINESS, slug: "tenant-two-salon", businessType: "salon" }],
      locations: [{ _id: LOCATION, business: BUSINESS, slug: "tenant-two-primary" }],
      domains: [
        { business: BUSINESS, host: "tenant-two.example.com" },
        { business: BUSINESS, host: "app.tenant-two.example.com" },
      ],
      memberships: [{ business: BUSINESS, user: OWNER }],
      manifests: [{ business: BUSINESS, manifestRevision: 1 }],
      users: [{ _id: OWNER }],
    },
  });

  assert.equal(plan.executable, true);
  assert.equal(plan.idempotentNoop, true);
  assert.equal(plan.operationCount, 0);
});

test("generic tenant provisioning fails closed on slug, domain and owner conflicts", () => {
  const wrongVertical = buildTenantProvisioningPlan({
    request: request(),
    snapshot: {
      businesses: [{ _id: BUSINESS, slug: "tenant-two-salon", businessType: "spa" }],
      users: [{ _id: OWNER }],
    },
  });
  assert.equal(wrongVertical.executable, false);
  assert.equal(
    wrongVertical.blockers.some((blocker) => blocker.type === "business-slug-conflict"),
    true
  );

  const domainCollision = buildTenantProvisioningPlan({
    request: request(),
    snapshot: {
      domains: [{ business: BUSINESS, host: "tenant-two.example.com" }],
      users: [{ _id: OWNER }],
    },
  });
  assert.equal(domainCollision.executable, false);
  assert.equal(
    domainCollision.blockers.some((blocker) => blocker.type === "domain-collision"),
    true
  );

  const missingOwner = buildTenantProvisioningPlan({
    request: request(),
    snapshot: { users: [] },
  });
  assert.equal(missingOwner.executable, false);
  assert.equal(
    missingOwner.blockers.some((blocker) => blocker.type === "owner-user-not-found"),
    true
  );
});

test("registered verticals are reusable and unsupported verticals fail closed", () => {
  for (const verticalId of ["salon", "spa", "fitness", "plastic-surgery"]) {
    const normalised = normaliseTenantProvisioningRequest(
      request({ verticalId, ownerUserId: "" })
    );
    assert.equal(normalised.verticalId, verticalId);
  }

  assert.throws(
    () => normaliseTenantProvisioningRequest(request({ verticalId: "unknown-vertical" })),
    /not supported by this build/
  );
});

test("write mode requires explicit confirmation and exact reviewed fingerprint", () => {
  const plan = buildTenantProvisioningPlan({
    request: request({ ownerUserId: "" }),
    snapshot: {},
  });

  assert.throws(
    () =>
      assertTenantProvisioningApplyAuthorization({
        args: [],
        environment: {},
        actualFingerprint: plan.fingerprint,
      }),
    /explicit --apply/
  );

  assert.throws(
    () =>
      assertTenantProvisioningApplyAuthorization({
        args: ["--apply"],
        environment: {},
        actualFingerprint: plan.fingerprint,
      }),
    /TENANT_PROVISIONING_CONFIRM/
  );

  assert.equal(
    assertTenantProvisioningApplyAuthorization({
      args: ["--apply"],
      environment: {
        TENANT_PROVISIONING_CONFIRM: "APPLY_GENERIC_TENANT_PROVISIONING",
        TENANT_PROVISIONING_PLAN_FINGERPRINT: plan.fingerprint,
      },
      actualFingerprint: plan.fingerprint,
    }),
    true
  );
});
