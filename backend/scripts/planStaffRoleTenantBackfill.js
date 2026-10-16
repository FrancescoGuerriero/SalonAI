import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Business from "../src/models/Business.js";
import StaffRole from "../src/models/StaffRole.js";
import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  planStaffRoleOwnershipBackfill,
} from "../src/platform/tenancy/staffRoleOwnershipMigration.js";
import {
  assertStaffRoleReadOnlyArguments,
} from "./checkStaffRoleTenantReadiness.js";

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI || environment.MONGO_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for StaffRole tenant backfill planning."
    );
  }

  return uri;
}

async function resolveCanonicalBusiness(configuration) {
  const business = await Business.findOne({
    slug: configuration.business.slug,
  })
    .select("_id")
    .lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete the canonical tenant bootstrap before StaffRole planning."
    );
  }

  return business;
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  assertStaffRoleReadOnlyArguments(args);

  const configuration = getCanonicalSalonTenantConfiguration(environment);

  await mongoose.connect(mongoUri(environment), {
    serverSelectionTimeoutMS: 15000,
  });

  const business = await resolveCanonicalBusiness(configuration);

  const [businesses, staffRoles] = await Promise.all([
    Business.find({}).sort({ _id: 1 }).select("_id").lean(),
    StaffRole.find({})
      .sort({ _id: 1 })
      .select("_id business key active")
      .lean(),
  ]);

  const plan = planStaffRoleOwnershipBackfill({
    businesses,
    staffRoles,
    businessId: business._id,
  });

  console.log(
    JSON.stringify(
      {
        readOnly: true,
        safeForBusinessBackfill:
          plan.readiness.safeForBusinessBackfill,
        summary: plan.readiness.summary,
        operationCount: plan.operationCount,
        rollbackCount: plan.rollbackCount,
        fingerprint: plan.fingerprint,
        identifiersIncluded: false,
        permissionsIncluded: false,
        writesPerformed: false,
      },
      null,
      2
    )
  );

  if (!plan.readiness.safeForBusinessBackfill) {
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
        "[FAIL] StaffRole tenant backfill plan:",
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
