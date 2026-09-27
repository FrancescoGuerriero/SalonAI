import "dotenv/config";

import {
  createHash,
} from "node:crypto";
import mongoose from "mongoose";
import {
  pathToFileURL,
} from "node:url";

import Business from "../src/models/Business.js";
import BusinessMembership from "../src/models/BusinessMembership.js";
import Location from "../src/models/Location.js";
import Stylist from "../src/models/Stylist.js";
import User from "../src/models/user.js";
import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  buildWorkforceBackfillPlan,
  buildWorkforceOwnershipReadiness,
} from "../src/platform/tenancy/workforceOwnershipMigration.js";
import {
  assertReadOnlyArguments,
} from "./checkWorkforceTenantReadiness.js";

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
      "MONGODB_URI is required for workforce backfill planning."
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
      "Canonical Business is missing. Integrate and complete the canonical tenant bootstrap gate before workforce backfill planning."
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
      "Canonical active primary Location is missing. Complete the canonical tenant bootstrap gate before workforce backfill planning."
    );
  }

  return {
    business,
    location,
  };
}

async function loadIdentityState(
  stylists
) {
  const linkedUserIds =
    [
      ...new Set(
        stylists
          .map(
            (stylist) =>
              String(
                stylist.userAccount ||
                  ""
              ).trim()
          )
          .filter(Boolean)
      ),
    ];

  const stylistEmails =
    [
      ...new Set(
        stylists
          .map(
            (stylist) =>
              String(
                stylist.email ||
                  ""
              )
                .trim()
                .toLowerCase()
          )
          .filter(Boolean)
      ),
    ];

  const users =
    await User.find({
      $or: [
        {
          _id: {
            $in:
              linkedUserIds,
          },
        },
        {
          email: {
            $in:
              stylistEmails,
          },
        },
      ],
    })
      .select(
        "_id email role isActive"
      )
      .lean();

  const userIds =
    users.map(
      (user) =>
        user._id
    );

  const memberships =
    userIds.length
      ? await BusinessMembership.find({
          user: {
            $in:
              userIds,
          },
        })
          .select(
            "_id user business status roleKey locationAccessMode locations"
          )
          .lean()
      : [];

  return {
    users,
    memberships,
  };
}

function countTypes(
  entries = []
) {
  const counts = {};

  for (
    const entry of
      Array.isArray(entries)
        ? entries
        : []
  ) {
    const type =
      String(
        entry?.type ||
          "unknown"
      );

    counts[type] =
      (
        counts[type] ||
        0
      ) + 1;
  }

  return counts;
}

export function sanitiseWorkforceBackfillPlan({
  readiness,
  plan,
} = {}) {
  const fingerprint =
    createHash(
      "sha256"
    )
      .update(
        JSON.stringify(
          plan || {}
        )
      )
      .digest(
        "hex"
      );

  return Object.freeze({
    dryRun: true,
    writesPerformed: false,
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
    planned:
      Object.freeze({
        ...(
          plan?.summary ||
          {}
        ),
        operationTypes:
          Object.freeze(
            countTypes(
              plan?.operations
            )
          ),
        rollbackTypes:
          Object.freeze(
            countTypes(
              plan?.rollback
            )
          ),
      }),
    planFingerprint:
      fingerprint,
    identifiersIncluded: false,
    piiIncluded: false,
    databaseWrites: false,
  });
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  assertReadOnlyArguments(
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

  const stylists =
    await Stylist.find({})
      .select(
        "_id business workingLocations userAccount email isActive acceptsAppointments profilePublished"
      )
      .lean();

  const {
    users,
    memberships,
  } =
    await loadIdentityState(
      stylists
    );

  const readiness =
    buildWorkforceOwnershipReadiness({
      stylists,
      users,
      memberships,
      businessId:
        business._id,
      locationId:
        location._id,
    });

  const plan =
    buildWorkforceBackfillPlan(
      readiness
    );

  console.log(
    JSON.stringify(
      sanitiseWorkforceBackfillPlan({
        readiness,
        plan,
      }),
      null,
      2
    )
  );

  if (
    !plan.executable
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
          "[FAIL] Workforce tenant backfill plan:",
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
