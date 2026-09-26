import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Business from "../src/models/Business.js";
import BusinessDomain from "../src/models/BusinessDomain.js";
import Location from "../src/models/Location.js";
import {
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
  const business = await Business.findOne({
    slug: configuration.business.slug,
  });

  const location = business
    ? await Location.findOne({
        business: business._id,
        slug: configuration.location.slug,
      })
    : null;

  const domains =
    await BusinessDomain.find({
      host: {
        $in:
          configuration.domains.map(
            (domain) =>
              domain.host
          ),
      },
    });

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
  let resolvedBusiness = business;
  let resolvedLocation = location;
  const domainsByHost =
    new Map(
      domains.map((domain) => [
        String(domain.host),
        domain,
      ])
    );

  if (!resolvedBusiness) {
    resolvedBusiness = await Business.create({
      name: configuration.business.name,
      slug: configuration.business.slug,
      businessType:
        configuration.business.businessType,
      status: "active",
      settings: configuration.business.settings,
      metadata: {
        canonicalReferenceApplication:
          "Salon AI",
        referenceTenant: true,
      },
    });
  }

  if (!resolvedLocation) {
    resolvedLocation = await Location.create({
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
    });
  }

  for (
    const expected of
      configuration.domains
  ) {
    if (
      domainsByHost.has(
        expected.host
      )
    ) {
      continue;
    }

    const created =
      await BusinessDomain.create({
        business:
          resolvedBusiness._id,
        host:
          expected.host,
        role:
          expected.role,
        status:
          "pending",
        redirectToPrimary:
          expected.redirectToPrimary,
        verification: {
          method:
            "manual",
        },
        metadata: {
          canonicalReferenceTenant:
            true,
        },
      });

    domainsByHost.set(
      expected.host,
      created
    );
  }

  return {
    business:
      resolvedBusiness,
    location:
      resolvedLocation,
    domains:
      [...domainsByHost.values()],
  };
}

function summary({
  mode,
  configuration,
  plan,
  business,
  location,
  domains = [],
}) {
  const domainsByHost =
    new Map(
      domains.map((domain) => [
        String(domain.host),
        domain,
      ])
    );

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
      action:
        plan.business.action,
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
      action:
        plan.location.action,
    },
    domains:
      plan.domains.map(
        (domainPlan) => {
          const domain =
            domainsByHost.get(
              domainPlan.host
            );

          return {
            id: domain
              ? String(domain._id)
              : domainPlan.id,
            host:
              domainPlan.host,
            role:
              domainPlan.role,
            status:
              domain?.status ||
              "pending",
            action:
              domainPlan.action,
          };
        }
      ),
    writesRequired:
      plan.writesRequired,
    domainBackfillPerformed:
      false,
    dnsMutationPerformed:
      false,
  };
}

function allResourcesPresent(plan) {
  return (
    plan.business.action ===
      "reuse" &&
    plan.location.action ===
      "reuse" &&
    plan.domains.every(
      (domain) =>
        domain.action ===
        "reuse"
    )
  );
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
      !allResourcesPresent(
        plan
      )
    ) {
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

  state =
    await createMissingResources({
      configuration,
      ...state,
    });

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
    !allResourcesPresent(
      plan
    )
  ) {
    throw new Error(
      "Canonical Francesco Picardi tenant bootstrap verification failed after apply."
    );
  }

  console.log(
    JSON.stringify(
      summary({
        mode:
          "verified-after-apply",
        configuration,
        plan,
        ...verifiedState,
      }),
      null,
      2
    )
  );

  console.log(
    "[PASS] Canonical Francesco Picardi Business/Location/Domain records were applied and verified. Domain mappings remain pending until separately verified/activated; existing domain collections were not backfilled and DNS was not changed."
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
