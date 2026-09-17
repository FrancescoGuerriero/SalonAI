import "dotenv/config";
import mongoose from "mongoose";

import Stylist from "../src/models/Stylist.js";

import {
  PRODUCTION_STYLIST_ROSTER,
  LEGACY_ROLLBACK_STYLIST_ROSTER,
  assertRosterDefinition,
  inspectRosterRecords,
  assertRosterInspection,
  selectRosterPhaseChanges,
} from "../src/services/productionStylistRosterService.js";

const APPLY_ARGUMENT = "--apply";
const VERIFY_ARGUMENT = "--verify";
const PREPARE_ARGUMENT = "--prepare";
const FINALIZE_ARGUMENT = "--finalize";
const LEGACY_ROLLBACK_ARGUMENT =
  "--legacy-rollback";

const CONFIRM_ARGUMENT =
  "--confirm=v8.14.10-production-stylist-roster";

function requireMongoUri() {
  const uri =
    String(
      process.env.MONGODB_URI || ""
    ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required."
    );
  }

  return uri;
}

function parseMode(argv) {
  const apply =
    argv.includes(
      APPLY_ARGUMENT
    );

  const verify =
    argv.includes(
      VERIFY_ARGUMENT
    );

  const prepare =
    argv.includes(
      PREPARE_ARGUMENT
    );

  const finalize =
    argv.includes(
      FINALIZE_ARGUMENT
    );

  const legacyRollback =
    argv.includes(
      LEGACY_ROLLBACK_ARGUMENT
    );

  const confirmed =
    argv.includes(
      CONFIRM_ARGUMENT
    );

  const selectedPhases =
    [
      prepare,
      finalize,
      legacyRollback,
    ].filter(Boolean).length;

  if (selectedPhases !== 1) {
    throw new Error(
      "Exactly one roster phase is required: --prepare, --finalize, or --legacy-rollback."
    );
  }

  if (apply && verify) {
    throw new Error(
      "--apply and --verify cannot be used together."
    );
  }

  if (apply && !confirmed) {
    throw new Error(
      `Applying the roster requires ${CONFIRM_ARGUMENT}.`
    );
  }

  return {
    apply,
    verify,
    phase:
      prepare
        ? "prepare"
        : finalize
          ? "finalize"
          : "legacy-rollback",
  };
}

function rosterForPhase(phase) {
  return phase === "legacy-rollback"
    ? LEGACY_ROLLBACK_STYLIST_ROSTER
    : PRODUCTION_STYLIST_ROSTER;
}

function selectPhaseInspection(
  inspection,
  phase
) {
  return {
    ...inspection,
    plan:
      inspection.plan.map(
        (item) => {
          const changes =
            selectRosterPhaseChanges(
              item.changes,
              phase
            );

          return {
            ...item,
            changes,
            alreadyCorrect:
              Object.keys(changes)
                .length === 0,
          };
        }
      ),
  };
}

function serialisePlan(
  inspection
) {
  return inspection.plan.map(
    (item) => ({
      id: item.id,
      name: item.name,
      classification:
        item.classification,
      alreadyCorrect:
        item.alreadyCorrect,
      changes:
        item.changes,
    })
  );
}

async function readRoster(
  collection,
  roster
) {
  const ids =
    roster.map(
      (entry) =>
        new mongoose.Types.ObjectId(
          entry.id
        )
    );

  return collection
    .find(
      {
        _id: {
          $in: ids,
        },
      },
      {
        projection: {
          firstName: 1,
          lastName: 1,
          name: 1,
          fullName: 1,
          jobTitle: 1,
          isActive: 1,
          acceptsAppointments: 1,
          profilePublished: 1,
          userAccount: 1,
        },
      }
    )
    .toArray();
}

async function verifyState(
  collection,
  phase
) {
  const roster =
    rosterForPhase(
      phase
    );

  const records =
    await readRoster(
      collection,
      roster
    );

  const completeInspection =
    inspectRosterRecords(
      records,
      roster
    );

  assertRosterInspection(
    completeInspection
  );

  return selectPhaseInspection(
    completeInspection,
    phase
  );
}

async function applyPlan(
  collection,
  inspection
) {
  let modifiedCount = 0;

  for (const item of inspection.plan) {
    if (item.alreadyCorrect) {
      continue;
    }

    const result =
      await collection.updateOne(
        {
          _id:
            new mongoose.Types.ObjectId(
              item.id
            ),
        },
        {
          $set:
            item.changes,
        }
      );

    if (result.matchedCount !== 1) {
      throw new Error(
        `Stylist record changed or disappeared during migration: ${item.id}.`
      );
    }

    modifiedCount +=
      result.modifiedCount;
  }

  return modifiedCount;
}

function findIncomplete(
  inspection
) {
  return inspection.plan.filter(
    (item) =>
      !item.alreadyCorrect
  );
}

async function main() {
  assertRosterDefinition(
    PRODUCTION_STYLIST_ROSTER
  );
  assertRosterDefinition(
    LEGACY_ROLLBACK_STYLIST_ROSTER
  );

  const {
    apply,
    verify,
    phase,
  } =
    parseMode(
      process.argv.slice(2)
    );

  await mongoose.connect(
    requireMongoUri()
  );

  const collection =
    mongoose.connection.collection(
      Stylist.collection.name
    );

  const before =
    await verifyState(
      collection,
      phase
    );

  console.log(
    JSON.stringify(
      {
        phase,
        mode:
          apply
            ? "apply"
            : verify
              ? "verify"
              : "dry-run",
        safe:
          before.safe,
        rosterCount:
          before.plan.length,
        plan:
          serialisePlan(
            before
          ),
      },
      null,
      2
    )
  );

  if (verify) {
    const incomplete =
      findIncomplete(
        before
      );

    if (incomplete.length > 0) {
      throw new Error(
        `Production stylist roster ${phase} verification found ${incomplete.length} record(s) requiring changes.`
      );
    }

    console.log(
      `[PASS] Production stylist roster ${phase} verification completed. No changes are required.`
    );

    return;
  }

  if (!apply) {
    console.log(
      `[PASS] Production stylist roster ${phase} dry-run completed. No database changes were made.`
    );

    return;
  }

  const modifiedCount =
    await applyPlan(
      collection,
      before
    );

  const after =
    await verifyState(
      collection,
      phase
    );

  const incomplete =
    findIncomplete(
      after
    );

  if (incomplete.length > 0) {
    throw new Error(
      `Production stylist roster ${phase} verification failed after apply.`
    );
  }

  console.log(
    `[PASS] Production stylist roster ${phase} classification complete. Modified ${modifiedCount} record(s).`
  );
}

main()
  .catch((error) => {
    console.error(
      "[FAIL] Production stylist roster classification:",
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
