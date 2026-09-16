import "dotenv/config";
import mongoose from "mongoose";

import Stylist from "../src/models/Stylist.js";

import {
  PRODUCTION_STYLIST_ROSTER,
  assertRosterDefinition,
  inspectRosterRecords,
  assertRosterInspection,
} from "../src/services/productionStylistRosterService.js";

const APPLY_ARGUMENT = "--apply";

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

  const confirmed =
    argv.includes(
      CONFIRM_ARGUMENT
    );

  if (apply && !confirmed) {
    throw new Error(
      `Applying the roster requires ${CONFIRM_ARGUMENT}.`
    );
  }

  return {
    apply,
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
  collection
) {
  const ids =
    PRODUCTION_STYLIST_ROSTER.map(
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
  collection
) {
  const records =
    await readRoster(
      collection
    );

  const inspection =
    inspectRosterRecords(
      records
    );

  assertRosterInspection(
    inspection
  );

  return inspection;
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
          $set: item.changes,
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

async function main() {
  assertRosterDefinition();

  const {
    apply,
  } = parseMode(
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
      collection
    );

  console.log(
    JSON.stringify(
      {
        mode:
          apply
            ? "apply"
            : "dry-run",
        safe: before.safe,
        rosterCount:
          before.plan.length,
        plan:
          serialisePlan(before),
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log(
      "[PASS] Production stylist roster dry-run completed. No database changes were made."
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
      collection
    );

  const incomplete =
    after.plan.filter(
      (item) =>
        !item.alreadyCorrect
    );

  if (incomplete.length > 0) {
    throw new Error(
      "Production stylist roster verification failed after apply."
    );
  }

  console.log(
    `[PASS] Production stylist roster classification complete. Modified ${modifiedCount} record(s).`
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
