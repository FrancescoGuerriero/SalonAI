import test from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCTION_STYLIST_ROSTER,
  assertRosterDefinition,
  inspectRosterRecords,
  assertRosterInspection,
  resolveRosterRecordName,
} from "../services/productionStylistRosterService.js";

function recordFor(
  target,
  overrides = {}
) {
  const [
    firstName,
    ...lastNameParts
  ] =
    target.expectedName
      .split(" ");

  return {
    _id: target.id,
    firstName,
    lastName:
      lastNameParts.join(" "),
    ...target.set,
    ...overrides,
  };
}

test(
  "production stylist roster contains nine unique controlled records",
  () => {
    assert.equal(
      PRODUCTION_STYLIST_ROSTER.length,
      9
    );

    assert.equal(
      assertRosterDefinition(),
      true
    );

    assert.equal(
      new Set(
        PRODUCTION_STYLIST_ROSTER.map(
          (entry) => entry.id
        )
      ).size,
      9
    );
  }
);

test(
  "production roster classifies exactly four appointment providers",
  () => {
    const bookable =
      PRODUCTION_STYLIST_ROSTER
        .filter(
          (entry) =>
            entry.set
              .acceptsAppointments ===
            true
        )
        .map(
          (entry) =>
            entry.expectedName
        );

    assert.deepEqual(
      bookable,
      [
        "Amara Okafor",
        "Sophie Bennett",
        "Daniel Kim",
        "Francesco Guerriero",
      ]
    );
  }
);

test(
  "reception office and assistant staff remain active but non-bookable",
  () => {
    const staff =
      PRODUCTION_STYLIST_ROSTER
        .filter(
          (entry) =>
            entry.classification ===
            "employee-non-bookable"
        );

    assert.equal(
      staff.length,
      4
    );

    for (const entry of staff) {
      assert.equal(
        entry.set.isActive,
        true
      );

      assert.equal(
        entry.set
          .acceptsAppointments,
        false
      );

      assert.equal(
        entry.set.profilePublished,
        false
      );
    }
  }
);

test(
  "legacy Francesco record remains historical and non-bookable",
  () => {
    const historical =
      PRODUCTION_STYLIST_ROSTER
        .find(
          (entry) =>
            entry.classification ===
            "historical-non-bookable"
        );

    assert.equal(
      historical.expectedName,
      "Francesco Guerriero"
    );

    assert.equal(
      historical.set.isActive,
      false
    );

    assert.equal(
      historical.set
        .acceptsAppointments,
      false
    );

    assert.equal(
      historical.set
        .profilePublished,
      false
    );
  }
);

test(
  "roster identity supports legacy raw name records",
  () => {
    assert.equal(
      resolveRosterRecordName({
        name: "Emma Johnson",
      }),
      "Emma Johnson"
    );
  }
);

test(
  "inspection fails closed when an expected record is missing",
  () => {
    const records =
      PRODUCTION_STYLIST_ROSTER
        .slice(1)
        .map(recordFor);

    const inspection =
      inspectRosterRecords(
        records
      );

    assert.equal(
      inspection.safe,
      false
    );

    assert.equal(
      inspection.missing.length,
      1
    );

    assert.throws(
      () =>
        assertRosterInspection(
          inspection
        ),
      /preflight failed/i
    );
  }
);

test(
  "inspection fails closed when an ID resolves to the wrong employee",
  () => {
    const records =
      PRODUCTION_STYLIST_ROSTER
        .map(recordFor);

    records[0].firstName =
      "Wrong";

    const inspection =
      inspectRosterRecords(
        records
      );

    assert.equal(
      inspection.safe,
      false
    );

    assert.equal(
      inspection.mismatched
        .length,
      1
    );
  }
);

test(
  "already classified roster produces an idempotent empty change plan",
  () => {
    const records =
      PRODUCTION_STYLIST_ROSTER
        .map(recordFor);

    const inspection =
      inspectRosterRecords(
        records
      );

    assert.equal(
      inspection.safe,
      true
    );

    assert.equal(
      inspection.plan.length,
      9
    );

    assert.equal(
      inspection.plan.every(
        (item) =>
          item.alreadyCorrect ===
          true &&
          Object.keys(
            item.changes
          ).length === 0
      ),
      true
    );
  }
);

test(
  "inspection plans only classification fields that differ",
  () => {
    const records =
      PRODUCTION_STYLIST_ROSTER
        .map(recordFor);

    const amara =
      records.find(
        (record) =>
          record._id ===
          "6a7c5c467c5b74ad029a28f9"
      );

    amara.acceptsAppointments =
      false;

    const inspection =
      inspectRosterRecords(
        records
      );

    const planned =
      inspection.plan.find(
        (item) =>
          item.id ===
          amara._id
      );

    assert.deepEqual(
      planned.changes,
      {
        acceptsAppointments:
          true,
      }
    );
  }
);
