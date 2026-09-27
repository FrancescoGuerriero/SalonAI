import test from "node:test";
import assert from "node:assert/strict";

import {
  assertReadOnlyArguments,
  sanitiseWorkforceReadiness,
} from "../../scripts/checkWorkforceTenantReadiness.js";

test("workforce readiness CLI refuses every write-like mode", () => {
  for (
    const argument of [
      "--apply",
      "--write",
      "--migrate",
      "--backfill",
      "--fix",
    ]
  ) {
    assert.throws(
      () =>
        assertReadOnlyArguments([
          argument,
        ]),
      /read-only/
    );
  }

  assert.equal(
    assertReadOnlyArguments(
      []
    ),
    true
  );
});

test("sanitized workforce readiness exposes counts without employee identifiers or email", () => {
  const report =
    sanitiseWorkforceReadiness({
      plan: {
        safeForBackfill:
          false,
        summary: {
          stylists: 9,
          noSignIn: 3,
          blockers: 2,
        },
        blockers: [
          {
            stylistId:
              "sensitive-id-one",
            blocker:
              "linked-user-missing",
          },
          {
            stylistId:
              "sensitive-id-two",
            blocker:
              "linked-user-missing",
          },
        ],
      },
      coverageByDomain: {
        stylists: {
          total: 9,
          businessScoped: 0,
          workingLocationScoped: 0,
        },
      },
      indexNames: [
        "_id_",
        "email_1",
        "userAccount_1",
        "other_index",
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
    report.piiIncluded,
    false
  );
  assert.deepEqual(
    report.workforce.blockerTypes,
    {
      "linked-user-missing":
        2,
    }
  );
  assert.deepEqual(
    report.legacyUniqueIndexes,
    [
      "email_1",
      "userAccount_1",
    ]
  );

  const text =
    JSON.stringify(
      report
    );

  assert.doesNotMatch(
    text,
    /sensitive-id/
  );
  assert.doesNotMatch(
    text,
    /@/
  );
});
