import "dotenv/config";

import {
  createHash,
} from "node:crypto";
import mongoose from "mongoose";
import {
  pathToFileURL,
} from "node:url";

import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  buildCustomerAppointmentBackfillPlan,
  sanitiseCustomerAppointmentMigrationScope,
} from "../src/platform/tenancy/customerAppointmentOwnershipMigration.js";
import {
  loadCustomerAppointmentOwnershipSnapshot,
} from "../src/platform/tenancy/customerAppointmentOwnershipSnapshot.js";
import {
  assertCustomerAppointmentReadOnlyArguments,
} from "./checkCustomerAppointmentTenantReadiness.js";

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
      "MONGODB_URI is required for Customer/Appointment backfill planning."
    );
  }

  return uri;
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

export function calculateCustomerAppointmentBackfillFingerprint({
  readiness,
  plan,
} = {}) {
  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify({
        businessId:
          readiness?.businessId ||
          null,
        locationId:
          readiness?.locationId ||
          null,
        scope:
          readiness?.scope ||
          null,
        customerPlans:
          readiness?.customerPlans ||
          [],
        appointmentPlans:
          readiness?.appointmentPlans ||
          [],
        plan:
          plan || null,
      })
    )
    .digest(
      "hex"
    );
}

export function sanitiseCustomerAppointmentBackfillPlan({
  readiness,
  plan,
} = {}) {
  const planFingerprint =
    calculateCustomerAppointmentBackfillFingerprint({
      readiness,
      plan,
    });

  return Object.freeze({
    dryRun:
      true,
    writesPerformed:
      false,
    databaseWrites:
      false,
    piiIncluded:
      false,
    identifiersIncluded:
      false,
    executable:
      Boolean(
        plan?.executable
      ),
    blocked:
      Boolean(
        plan?.blocked
      ),
    migrationScope:
      sanitiseCustomerAppointmentMigrationScope(
        readiness?.scope
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
    planFingerprint,
  });
}

export async function main(
  args = process.argv.slice(2),
  environment = process.env
) {
  assertCustomerAppointmentReadOnlyArguments(
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
    await loadCustomerAppointmentOwnershipSnapshot({
      configuration,
      includeIndexes:
        false,
    });

  const plan =
    buildCustomerAppointmentBackfillPlan(
      snapshot.readiness
    );

  const report =
    sanitiseCustomerAppointmentBackfillPlan({
      readiness:
        snapshot.readiness,
      plan,
    });

  console.log(
    JSON.stringify(
      report,
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
          "[FAIL] Customer/Appointment tenant backfill plan:",
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
