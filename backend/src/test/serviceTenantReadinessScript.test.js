import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  assertServiceReadOnlyArguments,
  sanitiseServiceCatalogueReadiness,
} from "../../scripts/checkServiceTenantReadiness.js";

test("Service readiness CLI rejects write-like flags", () => {
  for (
    const argument of [
      "--apply",
      "--write=true",
      "--migrate",
      "--backfill=1",
      "--fix",
      "--create-offerings",
    ]
  ) {
    assert.throws(
      () =>
        assertServiceReadOnlyArguments([
          argument,
        ]),
      /read-only/
    );
  }

  assert.equal(
    assertServiceReadOnlyArguments([]),
    true
  );
});

test("sanitized Service readiness exposes counts and blocker types without record identifiers", () => {
  const serviceId =
    new mongoose.Types.ObjectId();

  const report =
    sanitiseServiceCatalogueReadiness({
      safeForBusinessBackfill:
        false,
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
          1,
      },
      blockers: [
        {
          recordType:
            "service",
          recordId:
            String(
              serviceId
            ),
          blocker:
            "service-owned-by-other-business",
        },
      ],
    });

  assert.equal(
    report.readOnly,
    true
  );
  assert.equal(
    report.databaseWrites,
    false
  );
  assert.equal(
    report.identifiersIncluded,
    false
  );
  assert.equal(
    report.catalogueContentIncluded,
    false
  );
  assert.equal(
    report.summary.blockerTypes[
      "service-owned-by-other-business"
    ],
    1
  );

  assert.doesNotMatch(
    JSON.stringify(
      report
    ),
    new RegExp(
      String(
        serviceId
      )
    )
  );
});
