import test from "node:test";
import assert from "node:assert/strict";

import {
  assertWorkforceApplyAuthorization,
} from "../../scripts/applyWorkforceTenantBackfill.js";

const FINGERPRINT =
  "a".repeat(
    64
  );

function environment(
  overrides = {}
) {
  return {
    WORKFORCE_TENANT_BACKFILL_CONFIRM:
      "APPLY_WORKFORCE_TENANT_BACKFILL",
    WORKFORCE_TENANT_BACKFILL_PLAN_FINGERPRINT:
      FINGERPRINT,
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

test("workforce apply requires explicit --apply", () => {
  assert.throws(
    () =>
      assertWorkforceApplyAuthorization({
        args: [],
        environment:
          environment(),
        actualFingerprint:
          FINGERPRINT,
      }),
    /--apply/
  );
});

test("workforce apply requires exact confirmation phrase", () => {
  assert.throws(
    () =>
      assertWorkforceApplyAuthorization({
        args: [
          "--apply",
        ],
        environment:
          environment({
            WORKFORCE_TENANT_BACKFILL_CONFIRM:
              "YES",
          }),
        actualFingerprint:
          FINGERPRINT,
      }),
    /WORKFORCE_TENANT_BACKFILL_CONFIRM/
  );
});

test("workforce apply requires reviewed SHA-256 fingerprint", () => {
  assert.throws(
    () =>
      assertWorkforceApplyAuthorization({
        args: [
          "--apply",
        ],
        environment:
          environment({
            WORKFORCE_TENANT_BACKFILL_PLAN_FINGERPRINT:
              "b".repeat(
                64
              ),
          }),
        actualFingerprint:
          FINGERPRINT,
      }),
    /does not match/
  );

  assert.throws(
    () =>
      assertWorkforceApplyAuthorization({
        args: [
          "--apply",
        ],
        environment:
          environment({
            WORKFORCE_TENANT_BACKFILL_PLAN_FINGERPRINT:
              "not-a-fingerprint",
          }),
        actualFingerprint:
          FINGERPRINT,
      }),
    /64-character SHA-256/
  );
});

test("workforce apply requires explicit canonical tenant identity", () => {
  const env =
    environment();

  delete env
    .SALONAI_CANONICAL_PRIMARY_DOMAIN;

  assert.throws(
    () =>
      assertWorkforceApplyAuthorization({
        args: [
          "--apply",
        ],
        environment:
          env,
        actualFingerprint:
          FINGERPRINT,
      }),
    /SALONAI_CANONICAL_PRIMARY_DOMAIN/
  );
});

test("workforce apply authorisation succeeds only with all gates satisfied", () => {
  assert.equal(
    assertWorkforceApplyAuthorization({
      args: [
        "--apply",
      ],
      environment:
        environment(),
      actualFingerprint:
        FINGERPRINT,
    }),
    true
  );
});
