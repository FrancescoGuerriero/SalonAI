import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanonicalDomainActivationAuthorization,
} from "../../scripts/activateCanonicalTenantDomain.js";
import {
  getCanonicalSalonTenantConfiguration,
} from "../platform/tenancy/canonicalSalonTenantBootstrap.js";

function environment(
  overrides = {}
) {
  return {
    TENANT_DOMAIN_ACTIVATION_CONFIRM:
      "ACTIVATE_CANONICAL_TENANT_DOMAIN",
    TENANT_DOMAIN_ACTIVATION_HOST:
      "salonai.francescopicardi.co.uk",
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
    ...overrides,
  };
}

test("canonical domain activation requires explicit --apply", () => {
  const env =
    environment();

  assert.throws(
    () =>
      assertCanonicalDomainActivationAuthorization({
        args: [],
        environment:
          env,
        configuration:
          getCanonicalSalonTenantConfiguration(
            env
          ),
      }),
    /--apply/
  );
});

test("canonical domain activation requires exact confirmation phrase", () => {
  const env =
    environment({
      TENANT_DOMAIN_ACTIVATION_CONFIRM:
        "YES",
    });

  assert.throws(
    () =>
      assertCanonicalDomainActivationAuthorization({
        args: [
          "--apply",
        ],
        environment:
          env,
        configuration:
          getCanonicalSalonTenantConfiguration(
            env
          ),
      }),
    /TENANT_DOMAIN_ACTIVATION_CONFIRM/
  );
});

test("canonical domain activation accepts only an explicit canonical host", () => {
  const env =
    environment({
      TENANT_DOMAIN_ACTIVATION_HOST:
        "tenant-two.example.com",
    });

  assert.throws(
    () =>
      assertCanonicalDomainActivationAuthorization({
        args: [
          "--apply",
        ],
        environment:
          env,
        configuration:
          getCanonicalSalonTenantConfiguration(
            env
          ),
      }),
    /must exactly match/
  );
});

test("canonical domain activation requires explicit canonical tenant identity", () => {
  const env =
    environment();

  delete env
    .SALONAI_CANONICAL_PRIMARY_DOMAIN;

  assert.throws(
    () =>
      assertCanonicalDomainActivationAuthorization({
        args: [
          "--apply",
        ],
        environment:
          env,
        configuration:
          getCanonicalSalonTenantConfiguration(
            env
          ),
      }),
    /SALONAI_CANONICAL_PRIMARY_DOMAIN/
  );
});

test("canonical app-domain activation authorisation succeeds with every gate", () => {
  const env =
    environment();

  assert.equal(
    assertCanonicalDomainActivationAuthorization({
      args: [
        "--apply",
      ],
      environment:
        env,
      configuration:
        getCanonicalSalonTenantConfiguration(
          env
        ),
    }),
    true
  );
});
