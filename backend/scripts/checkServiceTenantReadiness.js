import "dotenv/config";

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
  buildServiceCatalogueReadiness,
} from "../src/platform/tenancy/serviceCatalogueMigration.js";

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
      "MONGODB_URI is required for Service tenant readiness."
    );
  }

  return uri;
}

export function assertServiceReadOnlyArguments(
  args = process.argv.slice(2)
) {
  const prohibitedPrefixes = [
    "--apply",
    "--write",
    "--migrate",
    "--backfill",
    "--fix",
    "--create-offerings",
  ];

  const supplied =
    (
      Array.isArray(
        args
      )
        ? args
        : []
    ).filter(
      (argument) => {
        const value =
          String(
            argument || ""
          ).trim();

        return prohibitedPrefixes.some(
          (prefix) =>
            value ===
              prefix ||
            value.startsWith(
              `${prefix}=`
            )
        );
      }
    );

  if (
    supplied.length >
      0
  ) {
    throw new Error(
      `Service tenant readiness is read-only. Unsupported write arguments: ${supplied.join(", ")}.`
    );
  }

  return true;
}

function groupedBlockers(
  blockers = []
) {
  const counts = {};

  for (
    const item of
      Array.isArray(
        blockers
      )
        ? blockers
        : []
  ) {
    const key =
      String(
        item?.blocker ||
          "unknown"
      );

    counts[key] =
      (
        counts[key] ||
        0
      ) + 1;
  }

  return counts;
}

export function sanitiseServiceCatalogueReadiness(
  readiness
) {
  return Object.freeze({
    readOnly:
      true,
    safeForBusinessBackfill:
      Boolean(
        readiness
          ?.safeForBusinessBackfill
      ),
    scope:
      Object.freeze({
        ...(
          readiness?.scope ||
          {}
        ),
      }),
    summary:
      Object.freeze({
        ...(
          readiness?.summary ||
          {}
        ),
        blockerTypes:
          Object.freeze(
            groupedBlockers(
              readiness?.blockers
            )
          ),
      }),
    identifiersIncluded:
      false,
    catalogueContentIncluded:
      false,
    databaseWrites:
      false,
  });
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
      "Canonical Business is missing. Complete the canonical tenant bootstrap before Service readiness."
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
      "Canonical active primary Location is missing. Complete the canonical tenant bootstrap before Service readiness."
    );
  }

  return {
    business,
    location,
  };
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

  const {
    business,
    location,
  } =
    await resolveCanonicalOwnership(
      configuration
    );

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

  const readiness =
    buildServiceCatalogueReadiness({
      businesses,
      locations,
      services,
      offerings,
      businessId:
        business._id,
      primaryLocationId:
        location._id,
    });

  console.log(
    JSON.stringify(
      {
        ...sanitiseServiceCatalogueReadiness(
          readiness
        ),
        canonicalBusinessResolved:
          true,
        canonicalLocationResolved:
          true,
      },
      null,
      2
    )
  );

  if (
    !readiness.safeForBusinessBackfill
  ) {
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
          "[FAIL] Service tenant readiness:",
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
