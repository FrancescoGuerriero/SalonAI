import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Business from "../src/models/Business.js";
import BusinessDomain from "../src/models/BusinessDomain.js";
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
      { slug: configuration.business.slug },
      { name: configuration.business.name },
    ],
  }).limit(2);

  if (businesses.length > 1) {
    const error = new Error(
      "More than one Business matches the configured canonical Salon AI tenant identity."
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
        { slug: configuration.location.slug },
        { name: configuration.location.name },
      ],
    }).limit(2);

    if (locations.length > 1) {
      const error = new Error(
        "More than one Location matches the configured canonical Salon AI tenant identity."
      );
      error.code = "CANONICAL_LOCATION_CONFLICT";
      throw error;
    }

    location = locations[0] || null;
  }

  const domains = await BusinessDomain.find({
    host: {
      $in: configuration.domains.map((domain) => domain.host),
    },
  }).limit(configuration.domains.length + 1);

  return {
    business,
    location,
    domains,
  };
}

async function createMissingResources({
  configuration,
  business,
  location,
  domains = [],
}) {
  const session = await mongoose.startSession();
  let resolvedBusiness = business;
  let resolvedLocation = location;
  const domainsByHost = new Map(
    domains.map((domain) => [
      String(domain.host),
      domain,
    ])
  );

  const created = {
    business: false,
    location: false,
    domains: [],
  };

  try {
    await session.withTransaction(async () => {
      if (!resolvedBusiness) {
        const records = await Business.create(
          [{
            name: configuration.business.name,
            slug: configuration.business.slug,
            businessType: configuration.business.businessType,
            status: "active",
            settings: configuration.business.settings,
            metadata: {
              canonicalReferenceApplication: "Salon AI",
              referenceTenant: true,
            },
          }],
          { session }
        );

        resolvedBusiness = records[0];
        created.business = true;
      }

      if (!resolvedLocation) {
        const records = await Location.create(
          [{
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
          }],
          { session }
        );

        resolvedLocation = records[0];
        created.location = true;
      }

      for (const expected of configuration.domains) {
        if (domainsByHost.has(expected.host)) {
          continue;
        }

        const records = await BusinessDomain.create(
          [{
            business: resolvedBusiness._id,
            host: expected.host,
            role: expected.role,
            status: "pending",
            redirectToPrimary: expected.redirectToPrimary,
            verification: {
              method: "manual",
            },
            metadata: {
              canonicalReferenceTenant: true,
            },
          }],
          { session }
        );

        const domain = records[0];
        domainsByHost.set(expected.host, domain);
        created.domains.push(domain);
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    business: resolvedBusiness,
    location: resolvedLocation,
    domains: [...domainsByHost.values()],
    created,
  };
}

function summary({
  mode,
  configuration,
  plan,
  business,
  location,
  domains = [],
  applicationResult = null,
}) {
  const domainsByHost = new Map(
    domains.map((domain) => [
      String(domain.host),
      domain,
    ])
  );

  const created = applicationResult?.created || null;

  return {
    mode,
    business: {
      id: business ? String(business._id) : plan.business.id,
      name: business?.name || configuration.business.name,
      slug: business?.slug || configuration.business.slug,
      businessType:
        business?.businessType ||
        configuration.business.businessType,
      action: plan.business.action,
    },
    location: {
      id: location ? String(location._id) : plan.location.id,
      name: location?.name || configuration.location.name,
      slug: location?.slug || configuration.location.slug,
      action: plan.location.action,
    },
    domains: plan.domains.map((domainPlan) => {
      const domain = domainsByHost.get(domainPlan.host);

      return {
        id: domain ? String(domain._id) : domainPlan.id,
        host: domainPlan.host,
        role: domainPlan.role,
        status: domain?.status || "pending",
        action: domainPlan.action,
      };
    }),
    writesRequired: plan.writesRequired,
    domainBackfillPerformed: false,
    dnsMutationPerformed: false,
    rollbackMetadata: created
      ? {
          createdBusinessId: created.business
            ? String(applicationResult.business?._id || "")
            : null,
          createdLocationId: created.location
            ? String(applicationResult.location?._id || "")
            : null,
          createdDomainIds: created.domains.map(
            (domain) => String(domain._id)
          ),
          safeRemovalOrder: [
            ...created.domains.map((domain) => ({
              resource: "BusinessDomain",
              id: String(domain._id),
            })),
            ...(created.location
              ? [{
                  resource: "Location",
                  id: String(applicationResult.location?._id || ""),
                }]
              : []),
            ...(created.business
              ? [{
                  resource: "Business",
                  id: String(applicationResult.business?._id || ""),
                }]
              : []),
          ],
        }
      : null,
  };
}

function allResourcesPresent(plan) {
  return (
    plan.business.action === "reuse" &&
    plan.location.action === "reuse" &&
    plan.domains.every((domain) => domain.action === "reuse")
  );
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  const mode = selectedMode(args, environment);

  if (mode === "apply") {
    assertExplicitCanonicalTenantIdentity(environment);
  }

  const configuration =
    getCanonicalSalonTenantConfiguration(environment);

  await mongoose.connect(mongoUri(environment));

  let state = await loadCurrentState(configuration);

  let plan = buildCanonicalTenantBootstrapPlan({
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
    if (!allResourcesPresent(plan)) {
      throw new Error(
        "Canonical Francesco Picardi tenant verification failed: one or more Business/Location/Domain resources are missing."
      );
    }

    console.log(
      "[PASS] Canonical Francesco Picardi tenant resources are present and compatible."
    );
    return;
  }

  if (mode === "dry-run") {
    console.log(
      "[PASS] Canonical tenant bootstrap dry-run completed. No database or DNS changes were made."
    );
    return;
  }

  const applicationResult = await createMissingResources({
    configuration,
    ...state,
  });

  state = {
    business: applicationResult.business,
    location: applicationResult.location,
    domains: applicationResult.domains,
  };

  const verifiedState = await loadCurrentState(configuration);

  plan = buildCanonicalTenantBootstrapPlan({
    ...verifiedState,
    configuration,
  });

  if (!allResourcesPresent(plan)) {
    throw new Error(
      "Canonical Francesco Picardi tenant bootstrap verification failed after apply."
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
    "[PASS] Canonical Francesco Picardi Business/Location/Domain records were applied and verified. Domain mappings remain pending until separately verified/activated; existing operational collections were not backfilled and DNS was not changed."
  );
}

const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

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
      await mongoose.disconnect().catch(() => {});
    });
}
