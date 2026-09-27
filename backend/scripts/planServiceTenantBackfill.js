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

export async function resolveCanonicalServiceOwnership(
  configuration,
  session = null
) {
  let businessQuery =
    Business.findOne({
      slug:
        configuration.business.slug,
    })
      .select(
        "_id name slug businessType"
      );

  if (session) {
    businessQuery =
      businessQuery.session(
        session
      );
  }

  const business =
    await businessQuery.lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete the canonical tenant bootstrap before Service backfill planning."
    );
  }

  let locationQuery =
    Location.findOne({
      business:
        business._id,
      slug:
        configuration.location.slug,
      status:
        "active",
    })
      .select(
        "_id business slug status"
      );

  if (session) {
    locationQuery =
      locationQuery.session(
        session
      );
  }

  const location =
    await locationQuery.lean();

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

export async function loadServiceCatalogueState({
  business,
  location,
  session = null,
}) {
  let businessesQuery =
    Business.find({})
      .sort({
        _id: 1,
      })
      .select(
        "_id"
      );
  let locationsQuery =
    Location.find({})
      .sort({
        _id: 1,
      })
      .select(
        "_id business status"
      );
  let servicesQuery =
    Service.find({})
      .sort({
        _id: 1,
      })
      .select(
        "_id business"
      );
  let offeringsQuery =
    LocationServiceOffering.find({})
      .sort({
        _id: 1,
      })
      .select(
        "_id business location service status"
      );

  if (session) {
    businessesQuery =
      businessesQuery.session(
        session
      );
    locationsQuery =
      locationsQuery.session(
        session
      );
    servicesQuery =
      servicesQuery.session(
        session
      );
    offeringsQuery =
      offeringsQuery.session(
        session
      );
  }

  const [
    businesses,
    locations,
    services,
    offerings,
  ] =
    await Promise.all([
      businessesQuery.lean(),
      locationsQuery.lean(),
      servicesQuery.lean(),
      offeringsQuery.lean(),
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

export async function loadServiceBackfillSnapshot({
  configuration,
  session = null,
} = {}) {
  const ownership =
    await resolveCanonicalServiceOwnership(
      configuration,
      session
    );

  const readiness =
    await loadServiceCatalogueState({
      ...ownership,
      session,
    });

  const plan =
    buildServiceBusinessBackfillPlan(
      readiness
    );

  const report =
    sanitiseServiceBackfillPlan({
      readiness,
      plan,
    });

  return {
    ...ownership,
    readiness,
    plan,
    report,
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

  const snapshot =
    await loadServiceBackfillSnapshot({
      configuration,
    });

  console.log(
    JSON.stringify(
      snapshot.report,
      null,
      2
    )
  );

  if (!snapshot.plan.executable) {
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
