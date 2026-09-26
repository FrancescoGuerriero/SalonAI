import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import {
  summariseDatabaseReadiness,
} from "../src/platform/tenancy/tenantMigrationReadiness.js";

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI ||
      environment.MONGO_URI ||
      ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for tenant migration readiness checks."
    );
  }

  return uri;
}

export function selectedCollectionNames(
  args = process.argv.slice(2)
) {
  const values = args
    .filter((value) =>
      String(value).startsWith("--collection=")
    )
    .map((value) =>
      String(value)
        .slice("--collection=".length)
        .trim()
    )
    .filter(Boolean);

  return [...new Set(values)];
}

async function inspectCollection(database, name) {
  const collection =
    database.collection(name);

  const [
    total,
    businessScoped,
    locationScoped,
    indexes,
  ] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({
      business: {
        $exists: true,
        $ne: null,
      },
    }),
    collection.countDocuments({
      location: {
        $exists: true,
        $ne: null,
      },
    }),
    collection.indexes(),
  ]);

  return {
    name,
    total,
    businessScoped,
    locationScoped,
    indexes,
  };
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  if (
    args.includes("--apply") ||
    args.includes("--write") ||
    args.includes("--migrate")
  ) {
    throw new Error(
      "Tenant migration readiness is read-only and does not support write/apply modes."
    );
  }

  await mongoose.connect(
    mongoUri(environment),
    {
      serverSelectionTimeoutMS: 15000,
    }
  );

  const database =
    mongoose.connection.db;

  const requested =
    selectedCollectionNames(args);

  const availableCollections =
    await database
      .listCollections(
        {},
        {
          nameOnly: true,
        }
      )
      .toArray();

  const availableNames =
    availableCollections
      .map((entry) =>
        String(entry.name || "").trim()
      )
      .filter(
        (name) =>
          name &&
          !name.startsWith("system.")
      );

  const names =
    requested.length > 0
      ? requested
      : availableNames;

  const missingRequested =
    requested.filter(
      (name) =>
        !availableNames.includes(name)
    );

  const inspected = [];

  for (const name of names) {
    if (!availableNames.includes(name)) {
      continue;
    }

    inspected.push(
      await inspectCollection(
        database,
        name
      )
    );
  }

  const report =
    summariseDatabaseReadiness(
      inspected
    );

  console.log(
    JSON.stringify(
      {
        ...report,
        requestedCollections:
          requested,
        missingRequestedCollections:
          missingRequested,
        dataExposure:
          "counts-and-index-metadata-only",
      },
      null,
      2
    )
  );

  if (missingRequested.length > 0) {
    process.exitCode = 2;
  }
}

const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1]
    ).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error(
        "[FAIL] Tenant migration readiness:",
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
