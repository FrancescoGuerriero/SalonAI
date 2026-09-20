import "dotenv/config";

import mongoose from "mongoose";

import connectDB from "../src/config/db.js";

const APPLY_CONFIRMATION =
  "RUN_STYLIST_BOOKABLE_MIGRATION";

export function normaliseLegacyStylistBookability(
  stylist = {}
) {
  return {
    bookable:
      typeof stylist.bookable ===
      "boolean"
        ? stylist.bookable
        : stylist.acceptsAppointments ===
          true,
  };
}

function parseArguments(values) {
  return {
    apply:
      values.includes(
        "--apply"
      ),
  };
}

function migrationFilter() {
  return {
    $or: [
      {
        bookable: {
          $exists: false,
        },
      },
      {
        acceptsAppointments: {
          $exists: true,
        },
      },
    ],
  };
}

async function run() {
  const options =
    parseArguments(
      process.argv.slice(2)
    );

  await connectDB();

  const collection =
    mongoose.connection.collection(
      "stylists"
    );

  const stylists =
    await collection
      .find(
        migrationFilter()
      )
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        isActive: 1,
        profilePublished: 1,
        bookable: 1,
        acceptsAppointments: 1,
      })
      .toArray();

  const preview =
    stylists.map(
      (stylist) => ({
        id:
          String(
            stylist._id
          ),
        name:
          [
            stylist.firstName,
            stylist.lastName,
          ]
            .filter(Boolean)
            .join(" ")
            .trim(),
        email:
          stylist.email || "",
        before: {
          isActive:
            stylist.isActive,
          profilePublished:
            stylist.profilePublished,
          bookable:
            stylist.bookable,
          legacyAcceptsAppointments:
            stylist.acceptsAppointments,
          hasLegacyAcceptsAppointments:
            Object.prototype.hasOwnProperty.call(
              stylist,
              "acceptsAppointments"
            ),
        },
        after:
          normaliseLegacyStylistBookability(
            stylist
          ),
      })
    );

  console.log(
    JSON.stringify(
      {
        mode:
          options.apply
            ? "apply"
            : "dry-run",
        candidates:
          preview.length,
        stylists:
          preview,
      },
      null,
      2
    )
  );

  if (!options.apply) {
    console.log(
      "Dry-run only. Re-run with --apply and STYLIST_BOOKABLE_MIGRATION_CONFIRM=RUN_STYLIST_BOOKABLE_MIGRATION to write changes."
    );
    return;
  }

  if (
    process.env
      .STYLIST_BOOKABLE_MIGRATION_CONFIRM !==
    APPLY_CONFIRMATION
  ) {
    throw new Error(
      "Refusing to apply stylist-bookable migration without STYLIST_BOOKABLE_MIGRATION_CONFIRM=RUN_STYLIST_BOOKABLE_MIGRATION."
    );
  }

  if (
    stylists.length >
    0
  ) {
    await collection.bulkWrite(
      stylists.map(
        (stylist) => ({
          updateOne: {
            filter: {
              _id:
                stylist._id,
            },
            update: {
              $set:
                normaliseLegacyStylistBookability(
                  stylist
                ),
              $unset: {
                acceptsAppointments:
                  "",
              },
            },
          },
        })
      ),
      {
        ordered: true,
      }
    );
  }

  const remaining =
    await collection.countDocuments(
      migrationFilter()
    );

  if (remaining !== 0) {
    throw new Error(
      `Stylist-bookable migration verification failed: ${remaining} legacy record(s) remain.`
    );
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        migrated:
          stylists.length,
        remaining,
      },
      null,
      2
    )
  );
}

const invokedDirectly =
  String(
    process.argv[1] || ""
  ).replace(/\\/g, "/")
    .endsWith(
      "/migrateStylistBookable.js"
    );

if (invokedDirectly) {
  run()
    .catch((error) => {
      console.error(
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose
        .disconnect()
        .catch(() => {});
    });
}
