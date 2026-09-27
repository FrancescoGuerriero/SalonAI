import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  buildWorkforceBackfillPlan,
  buildWorkforceOwnershipReadiness,
  WORKFORCE_MEMBERSHIP_MIGRATION_KEY,
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

  const grant =
    plan.operations.find(
      (item) =>
        item.type ===
        "membership-create"
    );

  assert.match(
    grant.grantReference,
    /^[a-f0-9]{64}$/
  );
  assert.equal(
    grant.provenanceKey,
    WORKFORCE_MEMBERSHIP_MIGRATION_KEY
  );

  const report =
    sanitiseWorkforceBackfillPlan({
      readiness,
      plan,
    });

  assert.equal(
    report.membershipGrantEvidence.length,
    1
  );
  assert.equal(
    report.membershipGrantEvidence[0]
      .grantReference,
    grant.grantReference
  );
  assert.equal(
    report.membershipGrantEvidence[0]
      .roleKey,
    "stylist"
  );
  assert.equal(
    report.membershipGrantEvidence[0]
      .locationAccessMode,
    "selected"
  );

  const reportText =
    JSON.stringify(
      report
    );

  assert.doesNotMatch(
    reportText,
    new RegExp(
      String(
        userId
      )
    )
  );
  assert.doesNotMatch(
    reportText,
    new RegExp(
      String(
        stylistId
      )
    )
  );
  assert.doesNotMatch(
    reportText,
    /linked@example\.com/
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
    report.planned.workforce.operationTypes[
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


test("sanitized combined workforce plan includes schedule operation counts without identifiers", () => {
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
            "employee@example.com",
        },
      ],
      users: [],
      memberships: [],
    });

  const plan =
    buildWorkforceBackfillPlan(
      readiness
    );

  const schedulePlan = {
    executable: true,
    blocked: false,
    summary: {
      operations: 2,
      rollbackOperations: 2,
      blockers: 0,
    },
    operationTypes: {
      "availability-update": 1,
      "shift-update": 1,
    },
    operations: [
      {
        type: "availability-update",
        recordId: String(oid()),
      },
      {
        type: "shift-update",
        recordId: String(oid()),
      },
    ],
    rollback: [
      {
        type: "availability-restore",
      },
      {
        type: "shift-restore",
      },
    ],
  };

  const report =
    sanitiseWorkforceBackfillPlan({
      readiness,
      plan,
      schedulePlan,
    });

  assert.equal(
    report.executable,
    true
  );
  assert.equal(
    report.planned.scheduleAndRota.operationTypes[
      "availability-update"
    ],
    1
  );
  assert.equal(
    report.planned.scheduleAndRota.rollbackTypes[
      "shift-restore"
    ],
    1
  );
  assert.equal(
    report.identifiersIncluded,
    false
  );

  const text =
    JSON.stringify(
      report
    );

  assert.doesNotMatch(
    text,
    /recordId/
  );
  assert.doesNotMatch(
    text,
    /employee@example\.com/
  );
});
