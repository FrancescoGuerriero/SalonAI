import test from "node:test";
import assert from "node:assert/strict";

import {
  PRODUCTION_STYLIST_ROSTER,
  LEGACY_ROLLBACK_STYLIST_ROSTER,
  assertRosterDefinition,
  inspectRosterRecords,
  assertRosterInspection,
  resolveRosterRecordName,
  selectRosterPhaseChanges,
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
              .bookable ===
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
          .bookable,
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
        .bookable,
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

    amara.bookable =
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
        bookable:
          true,
      }
    );
  }
);

test(
  "prepare phase changes only appointment capability",
  () => {
    assert.deepEqual(
      selectRosterPhaseChanges(
        {
          isActive: true,
          bookable: false,
          profilePublished: false,
          jobTitle: "Reception",
        },
        "prepare"
      ),
      {
        bookable: false,
      }
    );
  }
);

test(
  "finalize phase retains the complete required change set",
  () => {
    const changes = {
      isActive: true,
      bookable: false,
      profilePublished: false,
      jobTitle: "Reception",
    };

    assert.deepEqual(
      selectRosterPhaseChanges(
        changes,
        "finalize"
      ),
      changes
    );
  }
);

test(
  "legacy rollback roster preserves the nine controlled identities",
  () => {
    assert.equal(
      assertRosterDefinition(
        LEGACY_ROLLBACK_STYLIST_ROSTER
      ),
      true
    );

    assert.deepEqual(
      LEGACY_ROLLBACK_STYLIST_ROSTER.map(
        (entry) => [
          entry.id,
          entry.expectedName,
        ]
      ),
      PRODUCTION_STYLIST_ROSTER.map(
        (entry) => [
          entry.id,
          entry.expectedName,
        ]
      )
    );
  }
);

test(
  "legacy rollback keeps four providers active and makes all non-bookable records inactive",
  () => {
    const active =
      LEGACY_ROLLBACK_STYLIST_ROSTER.filter(
        (entry) => entry.set.isActive === true
      );

    const inactive =
      LEGACY_ROLLBACK_STYLIST_ROSTER.filter(
        (entry) => entry.set.isActive === false
      );

    assert.equal(
      active.length,
      4
    );
    assert.equal(
      inactive.length,
      5
    );

    assert.equal(
      active.every(
        (entry) =>
          entry.set.bookable === true
      ),
      true
    );

    assert.equal(
      inactive.every(
        (entry) =>
          entry.set.bookable === false
      ),
      true
    );
  }
);

test(
  "legacy rollback phase changes only legacy isActive compatibility state",
  () => {
    assert.deepEqual(
      selectRosterPhaseChanges(
        {
          isActive: false,
          bookable: false,
          profilePublished: false,
          jobTitle: "Reception",
        },
        "legacy-rollback"
      ),
      {
        isActive: false,
      }
    );
  }
);

test(
  "finalized roster produces exactly four legacy rollback safety changes",
  () => {
    const finalizedRecords =
      PRODUCTION_STYLIST_ROSTER.map(
        recordFor
      );

    const inspection =
      inspectRosterRecords(
        finalizedRecords,
        LEGACY_ROLLBACK_STYLIST_ROSTER
      );

    assert.equal(
      inspection.safe,
      true
    );

    const rollbackChanges =
      inspection.plan
        .map(
          (item) =>
            selectRosterPhaseChanges(
              item.changes,
              "legacy-rollback"
            )
        )
        .filter(
          (changes) =>
            Object.keys(changes).length > 0
        );

    assert.equal(
      rollbackChanges.length,
      4
    );

    assert.equal(
      rollbackChanges.every(
        (changes) =>
          changes.isActive === false &&
          Object.keys(changes).length === 1
      ),
      true
    );
  }
);

test(
  "legacy rollback state is idempotent",
  () => {
    const records =
      LEGACY_ROLLBACK_STYLIST_ROSTER.map(
        recordFor
      );

    const inspection =
      inspectRosterRecords(
        records,
        LEGACY_ROLLBACK_STYLIST_ROSTER
      );

    assert.equal(
      inspection.safe,
      true
    );

    assert.equal(
      inspection.plan.every(
        (item) =>
          Object.keys(
            selectRosterPhaseChanges(
              item.changes,
              "legacy-rollback"
            )
          ).length === 0
      ),
      true
    );
  }
);

test(
  "unknown roster phases fail closed",
  () => {
    assert.throws(
      () =>
        selectRosterPhaseChanges(
          {
            bookable:
              true,
          },
          "unknown"
        ),
      /unsupported production stylist roster phase/i
    );
  }
);
