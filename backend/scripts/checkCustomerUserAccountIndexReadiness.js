import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Customer from "../src/models/customer.js";
import {
  buildCustomerUserAccountIndexReadiness,
} from "../src/platform/data/customerUserAccountIndexMigration.js";

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI || environment.MONGO_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for Customer userAccount index readiness."
    );
  }

  return uri;
}

export function assertCustomerUserAccountIndexReadOnlyArguments(
  args = process.argv.slice(2)
) {
  const prohibitedPrefixes = [
    "--apply",
    "--write",
    "--migrate",
    "--fix",
    "--drop",
    "--create",
  ];

  const supplied = (Array.isArray(args) ? args : []).filter(
    (argument) => {
      const value = String(argument || "").trim();
      return prohibitedPrefixes.some(
        (prefix) =>
          value === prefix || value.startsWith(`${prefix}=`)
      );
    }
  );

  if (supplied.length > 0) {
    throw new Error(
      `Customer userAccount index readiness is read-only. Unsupported write arguments: ${supplied.join(", ")}.`
    );
  }

  return true;
}

async function duplicateLinkedAccountGroupCount() {
  const rows = await Customer.aggregate([
    {
      $match: {
        userAccount: {
          $type: "objectId",
        },
      },
    },
    {
      $group: {
        _id: "$userAccount",
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
    {
      $count: "count",
    },
  ]);

  return Number(rows?.[0]?.count || 0);
}

export async function loadCustomerUserAccountIndexState() {
  const [indexes, duplicateLinkedAccountGroups] =
    await Promise.all([
      Customer.collection.indexes(),
      duplicateLinkedAccountGroupCount(),
    ]);

  return {
    indexes,
    duplicateLinkedAccountGroups,
  };
}

export function sanitiseCustomerUserAccountIndexReadiness(
  readiness
) {
  return Object.freeze({
    readOnly: true,
    safeForMigration: Boolean(readiness?.safeForMigration),
    alreadyMigrated: Boolean(readiness?.alreadyMigrated),
    summary: Object.freeze({ ...(readiness?.summary || {}) }),
    blockerTypes: Object.freeze(
      Object.fromEntries(
        (readiness?.blockers || []).map((blocker) => [
          blocker.blocker,
          blocker.count || 1,
        ])
      )
    ),
    customerIdentifiersIncluded: false,
    databaseWrites: false,
  });
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  assertCustomerUserAccountIndexReadOnlyArguments(args);

  await mongoose.connect(mongoUri(environment), {
    serverSelectionTimeoutMS: 15000,
  });

  const state = await loadCustomerUserAccountIndexState();
  const readiness = buildCustomerUserAccountIndexReadiness(state);

  console.log(
    JSON.stringify(
      sanitiseCustomerUserAccountIndexReadiness(readiness),
      null,
      2
    )
  );

  if (!readiness.safeForMigration) {
    process.exitCode = 2;
  }
}

const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error(
        "[FAIL] Customer userAccount index readiness:",
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
