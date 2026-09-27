import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  assertServiceApplyAuthorization,
  assertServiceApplyPlan,
} from "../../scripts/applyServiceTenantBackfill.js";

const FINGERPRINT =
  "a".repeat(
    64
  );

function environment(
  overrides = {}
) {
  return {
    SERVICE_TENANT_BACKFILL_CONFIRM:
      "APPLY_SERVICE_TENANT_BACKFILL",
    SERVICE_TENANT_BACKFILL_PLAN_FINGERPRINT:
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

function plan(
  overrides = {}
) {
  return {
    dryRun:
      true,
    writesPerformed:
      false,
    executable:
      true,
    blocked:
      false,
    businessId:
      "business-1",
    summary: {
      serviceBusinessAssignments:
        1,
      rollbackServiceRestores:
        1,
      offeringsCreated:
        0,
      blockers:
        0,
    },
    operations: [
      {
        type:
          "service-business-assign",
        serviceId:
          "service-1",
        businessId:
          "business-1",
        expectedPreviousBusinessId:
          null,
      },
    ],
    rollback: [
      {
        type:
          "service-business-restore",
        serviceId:
          "service-1",
        previousBusinessId:
          null,
      },
    ],
    ...overrides,
  };
}

test("Service apply requires explicit --apply", () => {
  assert.throws(
    () =>
      assertServiceApplyAuthorization({
        args: [],
        environment:
          environment(),
        actualFingerprint:
          FINGERPRINT,
      }),
    /--apply/
  );
});

test("Service apply requires exact confirmation phrase", () => {
  assert.throws(
    () =>
      assertServiceApplyAuthorization({
        args: [
          "--apply",
        ],
        environment:
          environment({
            SERVICE_TENANT_BACKFILL_CONFIRM:
              "YES",
          }),
        actualFingerprint:
          FINGERPRINT,
      }),
    /SERVICE_TENANT_BACKFILL_CONFIRM/
  );
});

test("Service apply requires reviewed SHA-256 fingerprint", () => {
  assert.throws(
    () =>
      assertServiceApplyAuthorization({
        args: [
          "--apply",
        ],
        environment:
          environment({
            SERVICE_TENANT_BACKFILL_PLAN_FINGERPRINT:
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
      assertServiceApplyAuthorization({
        args: [
          "--apply",
        ],
        environment:
          environment({
            SERVICE_TENANT_BACKFILL_PLAN_FINGERPRINT:
              "not-a-fingerprint",
          }),
        actualFingerprint:
          FINGERPRINT,
      }),
    /64-character SHA-256/
  );
});

test("Service apply requires explicit canonical tenant identity", () => {
  const env =
    environment();

  delete env
    .SALONAI_CANONICAL_APP_DOMAIN;

  assert.throws(
    () =>
      assertServiceApplyAuthorization({
        args: [
          "--apply",
        ],
        environment:
          env,
        actualFingerprint:
          FINGERPRINT,
      }),
    /SALONAI_CANONICAL_APP_DOMAIN/
  );
});

test("Service apply authorisation succeeds only with all gates satisfied", () => {
  assert.equal(
    assertServiceApplyAuthorization({
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

test("Service apply accepts only unowned Service assignment operations", () => {
  assert.equal(
    assertServiceApplyPlan(
      plan()
    ),
    true
  );

  assert.throws(
    () =>
      assertServiceApplyPlan(
        plan({
          operations: [
            {
              type:
                "service-delete",
              serviceId:
                "service-1",
              businessId:
                "business-1",
              expectedPreviousBusinessId:
                null,
            },
          ],
        })
      ),
    /Unsupported Service backfill operation/
  );

  assert.throws(
    () =>
      assertServiceApplyPlan(
        plan({
          operations: [
            {
              type:
                "service-business-assign",
              serviceId:
                "service-1",
              businessId:
                "business-1",
              expectedPreviousBusinessId:
                "other-business",
            },
          ],
        })
      ),
    /currently unowned/
  );
});

test("Service apply rejects any plan that creates LocationServiceOffering records", () => {
  assert.throws(
    () =>
      assertServiceApplyPlan(
        plan({
          summary: {
            serviceBusinessAssignments:
              1,
            rollbackServiceRestores:
              1,
            offeringsCreated:
              1,
            blockers:
              0,
          },
        })
      ),
    /must not create LocationServiceOffering/
  );
});

test("Service apply executor is transactional and recomputes the shared reviewed snapshot", async () => {
  const source =
    await readFile(
      new URL(
        "../../scripts/applyServiceTenantBackfill.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /session\.withTransaction/
  );

  const snapshotCalls =
    source.match(
      /loadServiceBackfillSnapshot\(/g
    ) ||
    [];

  assert.ok(
    snapshotCalls.length >=
      3
  );

  assert.doesNotMatch(
    source,
    /LocationServiceOffering\.create/
  );
});
