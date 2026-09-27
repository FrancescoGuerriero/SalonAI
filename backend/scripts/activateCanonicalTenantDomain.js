import "dotenv/config";

import mongoose from "mongoose";
import {
  pathToFileURL,
} from "node:url";

import Business from "../src/models/Business.js";
import BusinessDomain from "../src/models/BusinessDomain.js";
import {
  assertExplicitCanonicalTenantIdentity,
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  normaliseTenantHost,
} from "../src/platform/tenancy/tenantHost.js";

const APPLY_CONFIRMATION =
  "ACTIVATE_CANONICAL_TENANT_DOMAIN";

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
      "MONGODB_URI is required for canonical domain activation."
    );
  }

  return uri;
}

function selectedHost(
  environment,
  configuration
) {
  const supplied =
    normaliseTenantHost(
      environment.TENANT_DOMAIN_ACTIVATION_HOST ||
        ""
    );

  const allowed =
    new Map(
      configuration.domains.map(
        (domain) => [
          domain.host,
          domain,
        ]
      )
    );

  const selected =
    allowed.get(
      supplied
    );

  if (!selected) {
    throw new Error(
      "TENANT_DOMAIN_ACTIVATION_HOST must exactly match one of the operator-approved canonical tenant domains."
    );
  }

  return selected;
}

export function assertCanonicalDomainActivationAuthorization({
  args = process.argv.slice(2),
  environment = process.env,
  configuration,
} = {}) {
  if (
    !Array.isArray(args) ||
    !args.includes("--apply")
  ) {
    throw new Error(
      "Canonical domain activation requires the explicit --apply flag."
    );
  }

  if (
    String(
      environment.TENANT_DOMAIN_ACTIVATION_CONFIRM ||
        ""
    ).trim() !==
      APPLY_CONFIRMATION
  ) {
    throw new Error(
      `Canonical domain activation requires TENANT_DOMAIN_ACTIVATION_CONFIRM=${APPLY_CONFIRMATION}.`
    );
  }

  assertExplicitCanonicalTenantIdentity(
    environment
  );

  selectedHost(
    environment,
    configuration
  );

  return true;
}

async function loadState({
  configuration,
  environment,
  session = null,
}) {
  const selected =
    selectedHost(
      environment,
      configuration
    );

  let businessQuery =
    Business.findOne({
      slug:
        configuration.business.slug,
    })
      .select(
        "_id name slug businessType status"
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
      "Canonical Business is missing."
    );
  }

  if (
    ![
      "trial",
      "active",
    ].includes(
      String(
        business.status ||
          ""
      )
    )
  ) {
    throw new Error(
      "Canonical Business is not available for public tenant routing."
    );
  }

  let domainQuery =
    BusinessDomain.findOne({
      host:
        selected.host,
    })
      .select(
        "_id business host role status redirectToPrimary verification"
      );

  if (session) {
    domainQuery =
      domainQuery.session(
        session
      );
  }

  const domain =
    await domainQuery.lean();

  if (!domain) {
    throw new Error(
      "Canonical BusinessDomain mapping is missing."
    );
  }

  if (
    String(
      domain.business
    ) !==
      String(
        business._id
      ) ||
    String(
      domain.role ||
        ""
    ) !==
      selected.role
  ) {
    throw new Error(
      "Canonical BusinessDomain mapping does not match the reviewed tenant identity."
    );
  }

  if (
    ![
      "pending",
      "active",
    ].includes(
      String(
        domain.status ||
          ""
      )
    )
  ) {
    throw new Error(
      "Canonical BusinessDomain is disabled and cannot be activated by this gate."
    );
  }

  return {
    business,
    domain,
    selected,
  };
}

function sanitiseState({
  state,
  mode,
  writesRequired,
} = {}) {
  return {
    mode,
    eligible:
      true,
    business: {
      slug:
        state.business.slug,
      status:
        state.business.status,
    },
    domain: {
      host:
        state.domain.host,
      role:
        state.domain.role,
      status:
        state.domain.status,
      action:
        state.domain.status ===
        "active"
          ? "reuse"
          : "activate",
    },
    writesRequired:
      Boolean(
        writesRequired
      ),
    dnsMutationPerformed:
      false,
    identifiersIncluded:
      false,
  };
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
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

  const preflight =
    await loadState({
      configuration,
      environment,
    });

  const apply =
    args.includes(
      "--apply"
    );

  if (!apply) {
    console.log(
      JSON.stringify(
        sanitiseState({
          state:
            preflight,
          mode:
            "dry-run",
          writesRequired:
            preflight.domain.status !==
              "active",
        }),
        null,
        2
      )
    );

    console.log(
      "[PASS] Canonical domain activation dry-run completed. No database or DNS changes were made."
    );
    return;
  }

  assertCanonicalDomainActivationAuthorization({
    args,
    environment,
    configuration,
  });

  if (
    preflight.domain.status ===
      "active"
  ) {
    console.log(
      JSON.stringify(
        sanitiseState({
          state:
            preflight,
          mode:
            "verified-before-apply",
          writesRequired:
            false,
        }),
        null,
        2
      )
    );
    console.log(
      "[PASS] Canonical domain is already active and compatible."
    );
    return;
  }

  const session =
    await mongoose.startSession();

  let activatedAt =
    null;

  try {
    await session.withTransaction(
      async () => {
        const current =
          await loadState({
            configuration,
            environment,
            session,
          });

        if (
          current.domain.status !==
            "pending"
        ) {
          throw new Error(
            "Canonical domain state changed after review. Transaction aborted."
          );
        }

        activatedAt =
          new Date();

        const result =
          await BusinessDomain.updateOne(
            {
              _id:
                current.domain._id,
              business:
                current.business._id,
              host:
                current.domain.host,
              role:
                current.domain.role,
              status:
                "pending",
            },
            {
              $set: {
                status:
                  "active",
                "verification.method":
                  "manual",
                "verification.verifiedAt":
                  activatedAt,
                "verification.checkedAt":
                  activatedAt,
              },
            },
            {
              session,
            }
          );

        if (
          result.matchedCount !==
            1 ||
          result.modifiedCount !==
            1
        ) {
          throw new Error(
            "Canonical domain activation precondition failed."
          );
        }

        const verified =
          await loadState({
            configuration,
            environment,
            session,
          });

        if (
          verified.domain.status !==
            "active"
        ) {
          throw new Error(
            "Canonical domain activation verification failed. Transaction aborted."
          );
        }
      }
    );
  } finally {
    await session.endSession();
  }

  const postflight =
    await loadState({
      configuration,
      environment,
    });

  console.log(
    JSON.stringify(
      {
        ...sanitiseState({
          state:
            postflight,
          mode:
            "verified-after-apply",
          writesRequired:
            false,
        }),
        verificationRecorded:
          Boolean(
            activatedAt
          ),
      },
      null,
      2
    )
  );

  console.log(
    "[PASS] Canonical tenant domain was activated and verified. DNS was not changed."
  );
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
          "[FAIL] Canonical domain activation:",
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
