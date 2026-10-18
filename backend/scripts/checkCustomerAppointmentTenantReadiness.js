import "dotenv/config";

import mongoose from "mongoose";
import {
  pathToFileURL,
} from "node:url";

import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  loadCustomerAppointmentOwnershipSnapshot,
} from "../src/platform/tenancy/customerAppointmentOwnershipSnapshot.js";
import {
  sanitiseCustomerAppointmentMigrationScope,
} from "../src/platform/tenancy/customerAppointmentOwnershipMigration.js";

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
      "MONGODB_URI is required for Customer/Appointment tenant readiness."
    );
  }

  return uri;
}

export function assertCustomerAppointmentReadOnlyArguments(
  args = process.argv.slice(2)
) {
  const writePrefixes = [
    "--apply",
    "--write",
    "--migrate",
    "--backfill",
    "--fix",
  ];

  const supplied =
    args.filter(
      (argument) => {
        const value =
          String(
            argument || ""
          ).trim();

        return writePrefixes.some(
          (prefix) =>
            value === prefix ||
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
      `Customer/Appointment tenant readiness is read-only. Unsupported write arguments: ${supplied.join(", ")}.`
    );
  }

  return true;
}

function blockerTypes(
  blockers = []
) {
  const counts = {};

  for (
    const item of
      Array.isArray(blockers)
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

function legacyIndexNames(
  indexes = [],
  expected = []
) {
  const expectedSet =
    new Set(
      expected
    );

  return (
    Array.isArray(indexes)
      ? indexes
      : []
  )
    .map(
      (index) =>
        String(
          index?.name ||
            ""
        )
    )
    .filter(
      (name) =>
        expectedSet.has(
          name
        )
    )
    .sort();
}

export function sanitiseCustomerAppointmentReadiness({
  readiness,
  customerCoverage,
  appointmentCoverage,
  customerIndexes = [],
  appointmentIndexes = [],
} = {}) {
  return Object.freeze({
    readOnly:
      true,
    databaseWrites:
      false,
    piiIncluded:
      false,
    identifiersIncluded:
      false,
    safeForBackfill:
      Boolean(
        readiness?.safeForBackfill
      ),
    migrationScope:
      sanitiseCustomerAppointmentMigrationScope(
        readiness?.scope
      ),
    summary:
      Object.freeze({
        ...(
          readiness?.summary ||
          {}
        ),
        blockerTypes:
          Object.freeze(
            blockerTypes(
              readiness?.blockers
            )
          ),
      }),
    coverage:
      Object.freeze({
        customers:
          Object.freeze({
            ...(
              customerCoverage ||
              {}
            ),
          }),
        appointments:
          Object.freeze({
            ...(
              appointmentCoverage ||
              {}
            ),
          }),
      }),
    legacyUniqueIndexes:
      Object.freeze({
        customers:
          Object.freeze(
            legacyIndexNames(
              customerIndexes,
              [
                "userAccount_1",
                "email_1",
                "phone_1",
              ]
            )
          ),
        appointments:
          Object.freeze(
            legacyIndexNames(
              appointmentIndexes,
              [
                "invoiceNumber_1",
                "externalBookingReference_1",
              ]
            )
          ),
      }),
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
        true,
    });

  const report =
    sanitiseCustomerAppointmentReadiness({
      readiness:
        snapshot.readiness,
      customerCoverage:
        snapshot.coverage.customers,
      appointmentCoverage:
        snapshot.coverage.appointments,
      customerIndexes:
        snapshot.indexes.customers,
      appointmentIndexes:
        snapshot.indexes.appointments,
    });

  console.log(
    JSON.stringify(
      report,
      null,
      2
    )
  );

  if (
    !snapshot.readiness.safeForBackfill
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
          "[FAIL] Customer/Appointment tenant readiness:",
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
