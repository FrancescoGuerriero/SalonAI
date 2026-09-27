import "dotenv/config";

import {
  createHash,
} from "node:crypto";
import mongoose from "mongoose";
import {
  pathToFileURL,
} from "node:url";

import Business from "../src/models/Business.js";
import Location from "../src/models/Location.js";
import LocationServiceOffering from "../src/models/LocationServiceOffering.js";
import Service from "../src/models/service.js";
import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  buildServiceBusinessBackfillPlan,
  buildServiceCatalogueReadiness,
} from "../src/platform/tenancy/serviceCatalogueMigration.js";
import {
  assertServiceReadOnlyArguments,
} from "./checkServiceTenantReadiness.js";

function mongoUri(
  environment = process.env
) {
  const uri =
    String(
      environment.MONGODB_URI ||
        environment.MONGO_URI ||
        ""
    ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for Service backfill planning."
    );
  }

  return uri;
}

async function resolveCanonicalOwnership(
  configuration
) {
  const business =
    await Business.findOne({
      slug:
        configuration.business.slug,
    })
      .select(
        "_id name slug businessType"
      )
      .lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete the canonical tenant bootstrap before Service backfill planning."
    );
  }

  const location =
    await Location.findOne({
      business:
        business._id,
      slug:
        configuration.location.slug,
      status:
        "active",
    })
      .select(
        "_id business slug status"
      )
      .lean();

  if (!location) {
    throw new Error(
      "Canonical active primary Location is missing. Complete the canonical tenant bootstrap before Service backfill planning."
    );
  }

  return {
    business,
    location,
  };
}

async function loadCatalogueState({
  business,
  location,
}) {
  const [
    businesses,
    locations,
    services,
    offerings,
  ] =
    await Promise.all([
      Business.find({})
        .sort({
          _id: 1,
        })
        .select(
          "_id"
        )
        .lean(),
      Location.find({})
        .sort({
          _id: 1,
        })
        .select(
          "_id business status"
        )
        .lean(),
      Service.find({})
        .sort({
          _id: 1,
        })
        .select(
          "_id business"
        )
        .lean(),
      LocationServiceOffering.find({})
        .sort({
          _id: 1,
        })
        .select(
          "_id business location service status"
        )
        .lean(),
    ]);

  return buildServiceCatalogueReadiness({
    businesses,
    locations,
    services,
    offerings,
    businessId:
      business._id,
    primaryLocationId:
      location._id,
  });
}

export function sanitiseServiceBackfillPlan({
  readiness,
  plan,
} = {}) {
  const planFingerprint =
    createHash(
      "sha256"
    )
      .update(
        JSON.stringify(
          plan ||
          {}
        )
      )
      .digest(
        "hex"
      );

  return Object.freeze({
    dryRun:
      true,
    writesPerformed:
      false,
    executable:
      Boolean(
        plan?.executable
      ),
    blocked:
      Boolean(
        plan?.blocked
      ),
    readiness:
      Object.freeze({
        ...(
          readiness?.summary ||
          {}
        ),
      }),
    scope:
      Object.freeze({
        ...(
          readiness?.scope ||
          {}
        ),
      }),
    planned:
      Object.freeze({
        ...(
          plan?.summary ||
          {}
        ),
      }),
    planFingerprint,
    identifiersIncluded:
      false,
    catalogueContentIncluded:
      false,
    databaseWrites:
      false,
  });
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  assertServiceReadOnlyArguments(
    args
  );

  const configuration =
    getCanonicalSalonTenantConfiguration(
      environment
    );

  await mongoose.connect(
    mongoUri(
      environment
    ),
    {
      serverSelectionTimeoutMS:
        15000,
    }
  );

  const ownership =
    await resolveCanonicalOwnership(
      configuration
    );

  const readiness =
    await loadCatalogueState(
      ownership
    );

  const plan =
    buildServiceBusinessBackfillPlan(
      readiness
    );

  console.log(
    JSON.stringify(
      sanitiseServiceBackfillPlan({
        readiness,
        plan,
      }),
      null,
      2
    )
  );

  if (!plan.executable) {
    process.exitCode =
      2;
  }
}

const executedDirectly =
  Boolean(
    process.argv[1]
  ) &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1]
    ).href;

if (executedDirectly) {
  main()
    .catch(
      (error) => {
        console.error(
          "[FAIL] Service tenant backfill plan:",
          error.message
        );
        process.exitCode =
          1;
      }
    )
    .finally(
      async () => {
        await mongoose
          .disconnect()
          .catch(
            () => {}
          );
      }
    );
}
