import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Business from "../src/models/Business.js";
import Location from "../src/models/Location.js";
import {
  assertExplicitCanonicalTenantIdentity,
  buildCanonicalTenantBootstrapPlan,
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";

const APPLY_CONFIRMATION =
  "BOOTSTRAP_CANONICAL_SALONAI_TENANT";

export function selectedMode(
  args = process.argv.slice(2),
  environment = process.env
) {
  const apply = args.includes("--apply");
  const verify = args.includes("--verify");

  if (apply && verify) {
    throw new Error(
      "--apply and --verify cannot be used together."
    );
  }

  if (
    apply &&
    environment.SALONAI_TENANT_BOOTSTRAP_CONFIRM !==
      APPLY_CONFIRMATION
  ) {
    throw new Error(
      `Applying the canonical tenant bootstrap requires SALONAI_TENANT_BOOTSTRAP_CONFIRM=${APPLY_CONFIRMATION}.`
    );
  }

  return apply
    ? "apply"
    : verify
      ? "verify"
      : "dry-run";
}

function mongoUri(environment = process.env) {
  const uri = String(
    environment.MONGODB_URI ||
      environment.MONGO_URI ||
      ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required for canonical tenant bootstrap."
    );
  }

  return uri;
}

async function loadCurrentState(configuration) {
  const businesses = await Business.find({
    $or: [
      {
        slug: configuration.business.slug,
      },
      {
        name: configuration.business.name,
      },
    ],
  }).limit(2);

  if (businesses.length > 1) {
    const error = new Error(
      "More than one Business matches the configured canonical SalonAI identity."
    );
    error.code = "CANONICAL_BUSINESS_CONFLICT";
    throw error;
  }

  const business = businesses[0] || null;

  let location = null;

  if (business) {
    const locations = await Location.find({
      business: business._id,
      $or: [
        {
          slug: configuration.location.slug,
        },
        {
          name: configuration.location.name,
        },
      ],
    }).limit(2);

    if (locations.length > 1) {
      const error = new Error(
        "More than one Location matches the configured canonical SalonAI identity."
      );
      error.code = "CANONICAL_LOCATION_CONFLICT";
      throw error;
    }

    location = locations[0] || null;
  }

  return {
    business,
    location,
  };
}

async function createMissingResources({
  configuration,
  business,
  location,
}) {
  const session = await mongoose.startSession();
  let resolvedBusiness = business;
  let resolvedLocation = location;
  let createdBusiness = false;
  let createdLocation = false;

  try {
    await session.withTransaction(async () => {
      if (!resolvedBusiness) {
        const records = await Business.create(
          [
            {
              name: configuration.business.name,
              slug: configuration.business.slug,
              businessType:
                configuration.business.businessType,
              status: "active",
              settings: configuration.business.settings,
              metadata: {
                canonicalReferenceApplication:
                  "Salon AI",
              },
            },
          ],
          {
            session,
          }
        );

        resolvedBusiness = records[0];
        createdBusiness = true;
      }

      if (!resolvedLocation) {
        const records = await Location.create(
          [
            {
              business: resolvedBusiness._id,
              name: configuration.location.name,
              slug: configuration.location.slug,
              status: "active",
              settings: {
                timezone: "",
                locale: "",
                currency: "",
              },
              metadata: {
                canonicalReferenceLocation: true,
              },
            },
          ],
          {
            session,
          }
        );

        resolvedLocation = records[0];
        createdLocation = true;
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    business: resolvedBusiness,
    location: resolvedLocation,
    createdBusiness,
    createdLocation,
  };
}

function summary({
  mode,
  configuration,
  plan,
  business,
  location,
  applicationResult = null,
}) {
  return {
    mode,
    business: {
      id: business
        ? String(business._id)
        : plan.business.id,
      name:
        business?.name ||
        configuration.business.name,
      slug:
        business?.slug ||
        configuration.business.slug,
      businessType:
        business?.businessType ||
        configuration.business.businessType,
      action: plan.business.action,
    },
    location: {
      id: location
        ? String(location._id)
        : plan.location.id,
      name:
        location?.name ||
        configuration.location.name,
      slug:
        location?.slug ||
        configuration.location.slug,
      action: plan.location.action,
    },
    writesRequired:
      plan.writesRequired,
    domainBackfillPerformed:
      false,
    rollbackMetadata: applicationResult
      ? {
          createdBusinessId:
            applicationResult.createdBusiness
              ? String(applicationResult.business?._id || "")
              : null,
          createdLocationId:
            applicationResult.createdLocation
              ? String(applicationResult.location?._id || "")
              : null,
          safeRemovalOrder: [
            ...(applicationResult.createdLocation
              ? [
                  {
                    resource: "Location",
                    id: String(applicationResult.location?._id || ""),
                  },
                ]
              : []),
            ...(applicationResult.createdBusiness
              ? [
                  {
                    resource: "Business",
                    id: String(applicationResult.business?._id || ""),
                  },
                ]
              : []),
          ],
        }
      : null,
  };
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  const mode =
    selectedMode(
      args,
      environment
    );

  if (mode === "apply") {
    assertExplicitCanonicalTenantIdentity(
      environment
    );
  }

  const configuration =
    getCanonicalSalonTenantConfiguration(
      environment
    );

  await mongoose.connect(
    mongoUri(environment)
  );

  let state =
    await loadCurrentState(
      configuration
    );

  let plan =
    buildCanonicalTenantBootstrapPlan({
      ...state,
      configuration,
    });

  console.log(
    JSON.stringify(
      summary({
        mode,
        configuration,
        plan,
        ...state,
      }),
      null,
      2
    )
  );

  if (mode === "verify") {
    if (
      plan.business.action !==
        "reuse" ||
      plan.location.action !==
        "reuse"
    ) {
      throw new Error(
        "Canonical Salon AI Business/Location verification failed: one or more resources are missing."
      );
    }

    console.log(
      "[PASS] Canonical Salon AI tenant resources are present and compatible."
    );
    return;
  }

  if (mode === "dry-run") {
    console.log(
      "[PASS] Canonical tenant bootstrap dry-run completed. No database changes were made."
    );
    return;
  }

  const applicationResult =
    await createMissingResources({
      configuration,
      ...state,
    });

  state = {
    business: applicationResult.business,
    location: applicationResult.location,
  };

  const verifiedState =
    await loadCurrentState(
      configuration
    );

  plan =
    buildCanonicalTenantBootstrapPlan({
      ...verifiedState,
      configuration,
    });

  if (
    plan.business.action !==
      "reuse" ||
    plan.location.action !==
      "reuse"
  ) {
    throw new Error(
      "Canonical Salon AI tenant bootstrap verification failed after apply."
    );
  }

  console.log(
    JSON.stringify(
      summary({
        mode: "verified-after-apply",
        configuration,
        plan,
        ...verifiedState,
        applicationResult,
      }),
      null,
      2
    )
  );

  console.log(
    "[PASS] Canonical Salon AI Business/Location bootstrap applied and verified. Existing domain collections were not backfilled."
  );
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
        "[FAIL] Canonical tenant bootstrap:",
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
