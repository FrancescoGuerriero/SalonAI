import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Business from "../src/models/Business.js";
import StaffRole from "../src/models/StaffRole.js";
import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  buildStaffRoleOwnershipReadiness,
} from "../src/platform/tenancy/staffRoleOwnershipMigration.js";

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI || environment.MONGO_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for StaffRole tenant readiness."
    );
  }

  return uri;
}

export function assertStaffRoleReadOnlyArguments(
  args = process.argv.slice(2)
) {
  const prohibitedPrefixes = [
    "--apply",
    "--write",
    "--migrate",
    "--backfill",
    "--fix",
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
      `StaffRole tenant readiness is read-only. Unsupported write arguments: ${supplied.join(", ")}.`
    );
  }

  return true;
}

function groupedBlockers(blockers = []) {
  const counts = {};

  for (const item of Array.isArray(blockers) ? blockers : []) {
    const key = String(item?.blocker || "unknown");
    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
}

export function sanitiseStaffRoleReadiness(readiness) {
  return Object.freeze({
    readOnly: true,
    safeForBusinessBackfill: Boolean(
      readiness?.safeForBusinessBackfill
    ),
    scope: Object.freeze({ ...(readiness?.scope || {}) }),
    summary: Object.freeze({
      ...(readiness?.summary || {}),
      blockerTypes: Object.freeze(
        groupedBlockers(readiness?.blockers)
      ),
    }),
    identifiersIncluded: false,
    permissionsIncluded: false,
    databaseWrites: false,
  });
}

async function resolveCanonicalBusiness(configuration) {
  const business = await Business.findOne({
    slug: configuration.business.slug,
  })
    .select("_id")
    .lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete the canonical tenant bootstrap before StaffRole readiness."
    );
  }

  return business;
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  assertStaffRoleReadOnlyArguments(args);

  const configuration = getCanonicalSalonTenantConfiguration(
    environment
  );

  await mongoose.connect(mongoUri(environment), {
    serverSelectionTimeoutMS: 15000,
  });

  const business = await resolveCanonicalBusiness(configuration);

  const [businesses, staffRoles] = await Promise.all([
    Business.find({})
      .sort({ _id: 1 })
      .select("_id")
      .lean(),
    StaffRole.find({})
      .sort({ _id: 1 })
      .select("_id business key active")
      .lean(),
  ]);

  const readiness = buildStaffRoleOwnershipReadiness({
    businesses,
    staffRoles,
    businessId: business._id,
  });

  console.log(
    JSON.stringify(
      {
        ...sanitiseStaffRoleReadiness(readiness),
        canonicalBusinessResolved: true,
      },
      null,
      2
    )
  );

  if (!readiness.safeForBusinessBackfill) {
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
        "[FAIL] StaffRole tenant readiness:",
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
