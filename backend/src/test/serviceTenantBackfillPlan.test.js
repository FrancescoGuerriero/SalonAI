import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  sanitiseServiceBackfillPlan,
} from "../../scripts/planServiceTenantBackfill.js";

test("Service backfill report exposes fingerprint and counts without identifiers", () => {
  const serviceId =
    new mongoose.Types.ObjectId();
  const businessId =
    new mongoose.Types.ObjectId();

  const readiness = {
    scope: {
      businessCount:
        1,
      canonicalBusinessCount:
        1,
      otherBusinessCount:
        0,
    },
    summary: {
      services:
        36,
      businessAssignments:
        36,
      alreadyBusinessOwned:
        0,
      offerings:
        0,
      blockers:
        0,
    },
  };

  const plan = {
    executable:
      true,
    blocked:
      false,
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
          String(
            serviceId
          ),
        businessId:
          String(
            businessId
          ),
      },
    ],
    rollback: [
      {
        type:
          "service-business-restore",
        serviceId:
          String(
            serviceId
          ),
      },
    ],
  };

  const report =
    sanitiseServiceBackfillPlan({
      readiness,
      plan,
    });

  assert.equal(
    report.databaseWrites,
    false
  );
  assert.equal(
    report.catalogueContentIncluded,
    false
  );
  assert.equal(
    report.identifiersIncluded,
    false
  );
  assert.equal(
    report.planFingerprint.length,
    64
  );
  assert.equal(
    report.planned.offeringsCreated,
    0
  );

  const text =
    JSON.stringify(
      report
    );

  assert.doesNotMatch(
    text,
    new RegExp(
      String(
        serviceId
      )
    )
  );
  assert.doesNotMatch(
    text,
    new RegExp(
      String(
        businessId
      )
    )
  );
});
