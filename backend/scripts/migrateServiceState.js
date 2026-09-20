import "dotenv/config";

import mongoose from "mongoose";

import connectDB from "../src/config/db.js";

const APPLY_CONFIRMATION =
  "RUN_SERVICE_STATE_MIGRATION";

export function normaliseLegacyServiceState(
  service = {}
) {
  const active =
    service.active !== false;

  return {
    published:
      typeof service.published ===
      "boolean"
        ? service.published
        : active,
    bookable:
      typeof service.bookable ===
      "boolean"
        ? service.bookable
        : service.onlineBookable !==
          false,
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
        published: {
          $exists: false,
        },
      },
      {
        bookable: {
          $exists: false,
        },
      },
      {
        onlineBookable: {
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
      "services"
    );

  const services =
    await collection
      .find(
        migrationFilter()
      )
      .project({
        _id: 1,
        name: 1,
        active: 1,
        published: 1,
        bookable: 1,
        onlineBookable: 1,
      })
      .toArray();

  const preview =
    services.map(
      (service) => ({
        id:
          String(
            service._id
          ),
        name:
          service.name || "",
        before: {
          active:
            service.active,
          published:
            service.published,
          bookable:
            service.bookable,
          hasLegacyOnlineBookable:
            Object.prototype.hasOwnProperty.call(
              service,
              "onlineBookable"
            ),
        },
        after:
          normaliseLegacyServiceState(
            service
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
        services:
          preview,
      },
      null,
      2
    )
  );

  if (!options.apply) {
    console.log(
      "Dry-run only. Re-run with --apply and SERVICE_STATE_MIGRATION_CONFIRM=RUN_SERVICE_STATE_MIGRATION to write changes."
    );
    return;
  }

  if (
    process.env
      .SERVICE_STATE_MIGRATION_CONFIRM !==
    APPLY_CONFIRMATION
  ) {
    throw new Error(
      "Refusing to apply service-state migration without SERVICE_STATE_MIGRATION_CONFIRM=RUN_SERVICE_STATE_MIGRATION."
    );
  }

  if (
    services.length >
    0
  ) {
    await collection.bulkWrite(
      services.map(
        (service) => ({
          updateOne: {
            filter: {
              _id:
                service._id,
            },
            update: {
              $set:
                normaliseLegacyServiceState(
                  service
                ),
              $unset: {
                onlineBookable:
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
      `Service-state migration verification failed: ${remaining} legacy record(s) remain.`
    );
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        migrated:
          services.length,
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
      "/migrateServiceState.js"
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
