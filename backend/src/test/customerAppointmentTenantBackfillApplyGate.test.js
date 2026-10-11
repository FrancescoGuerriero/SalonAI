import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCustomerAppointmentApplyAuthorization,
} from "../../scripts/applyCustomerAppointmentTenantBackfill.js";

const FINGERPRINT = "a".repeat(64);

function environment(overrides = {}) {
  return {
    CUSTOMER_APPOINTMENT_TENANT_BACKFILL_CONFIRM:
      "APPLY_CUSTOMER_APPOINTMENT_TENANT_BACKFILL",
    CUSTOMER_APPOINTMENT_TENANT_BACKFILL_PLAN_FINGERPRINT:
      FINGERPRINT,
    CANONICAL_TENANT_BUSINESS_SLUG:
      "francesco-picardi",
    CANONICAL_TENANT_LOCATION_SLUG:
      "marylebone",
    ...overrides,
  };
}

test("Customer/Appointment apply requires explicit write intent", () => {
  assert.throws(
    () =>
      assertCustomerAppointmentApplyAuthorization({
        args: [],
        environment: environment(),
        actualFingerprint: FINGERPRINT,
      }),
    /--apply/
  );
});

test("Customer/Appointment apply requires the exact confirmation token", () => {
  assert.throws(
    () =>
      assertCustomerAppointmentApplyAuthorization({
        args: ["--apply"],
        environment: environment({
          CUSTOMER_APPOINTMENT_TENANT_BACKFILL_CONFIRM: "WRONG",
        }),
        actualFingerprint: FINGERPRINT,
      }),
    /APPLY_CUSTOMER_APPOINTMENT_TENANT_BACKFILL/
  );
});

test("Customer/Appointment apply rejects invalid or stale fingerprints", () => {
  assert.throws(
    () =>
      assertCustomerAppointmentApplyAuthorization({
        args: ["--apply"],
        environment: environment({
          CUSTOMER_APPOINTMENT_TENANT_BACKFILL_PLAN_FINGERPRINT: "short",
        }),
        actualFingerprint: FINGERPRINT,
      }),
    /64-character/
  );

  assert.throws(
    () =>
      assertCustomerAppointmentApplyAuthorization({
        args: ["--apply"],
        environment: environment(),
        actualFingerprint: "b".repeat(64),
      }),
    /does not match/
  );
});
