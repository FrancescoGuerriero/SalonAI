import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  buildWorkforceBackfillPlan,
  buildWorkforceOwnershipReadiness,
} from "../platform/tenancy/workforceOwnershipMigration.js";
import {
  sanitiseWorkforceBackfillPlan,
} from "../../scripts/planWorkforceTenantBackfill.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

test("workforce backfill plan produces deterministic stylist and membership operations without writes", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const userId =
    oid();
  const stylistId =
    oid();

  const readiness =
    buildWorkforceOwnershipReadiness({
      businessId,
      locationId,
      stylists: [
        {
          _id:
            stylistId,
          userAccount:
            userId,
          email:
            "linked@example.com",
          workingLocations:
            [],
        },
      ],
      users: [
        {
          _id:
            userId,
          email:
            "linked@example.com",
          role:
            "stylist",
        },
      ],
      memberships: [],
    });

  const plan =
    buildWorkforceBackfillPlan(
      readiness
    );

  assert.equal(
    plan.dryRun,
    true
  );
  assert.equal(
    plan.writesPerformed,
    false
  );
  assert.equal(
    plan.executable,
    true
  );
  assert.equal(
    plan.blocked,
    false
  );
  assert.equal(
    plan.summary.stylistUpdates,
    1
  );
  assert.equal(
    plan.summary.membershipCreates,
    1
  );
  assert.deepEqual(
    plan.operations.map(
      (item) =>
        item.type
    ),
    [
      "stylist-update",
      "membership-create",
    ]
  );
  assert.deepEqual(
    plan.rollback.map(
      (item) =>
        item.type
    ),
    [
      "stylist-restore",
      "membership-delete",
    ]
  );
});

test("blocked workforce readiness never produces executable operations", () => {
  const businessId =
    oid();
  const locationId =
    oid();

  const readiness =
    buildWorkforceOwnershipReadiness({
      businessId,
      locationId,
      stylists: [
        {
          _id:
            oid(),
          business:
            oid(),
          email:
            "conflict@example.com",
        },
      ],
      users: [],
      memberships: [],
    });

  const plan =
    buildWorkforceBackfillPlan(
      readiness
    );

  assert.equal(
    plan.executable,
    false
  );
  assert.equal(
    plan.blocked,
    true
  );
  assert.equal(
    plan.operations.length,
    0
  );
  assert.equal(
    plan.rollback.length,
    0
  );
});

test("sanitized workforce backfill plan hides identifiers while preserving deterministic evidence", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const stylistId =
    oid();

  const readiness =
    buildWorkforceOwnershipReadiness({
      businessId,
      locationId,
      stylists: [
        {
          _id:
            stylistId,
          email:
            "nosignin@example.com",
          workingLocations:
            [],
        },
      ],
      users: [],
      memberships: [],
    });

  const plan =
    buildWorkforceBackfillPlan(
      readiness
    );

  const report =
    sanitiseWorkforceBackfillPlan({
      readiness,
      plan,
    });

  assert.equal(
    report.databaseWrites,
    false
  );
  assert.equal(
    report.identifiersIncluded,
    false
  );
  assert.equal(
    report.piiIncluded,
    false
  );
  assert.equal(
    report.planFingerprint.length,
    64
  );
  assert.equal(
    report.planned.operationTypes[
      "stylist-update"
    ],
    1
  );

  const text =
    JSON.stringify(
      report
    );

  assert.doesNotMatch(
    text,
    new RegExp(
      String(
        stylistId
      )
    )
  );
  assert.doesNotMatch(
    text,
    /nosignin@example\.com/
  );
});
