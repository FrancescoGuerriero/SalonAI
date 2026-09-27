import "dotenv/config";

import mongoose from "mongoose";
import {
  pathToFileURL,
} from "node:url";

import Appointment from "../src/models/Appointment.js";
import Business from "../src/models/Business.js";
import Customer from "../src/models/customer.js";
import Location from "../src/models/Location.js";
import Service from "../src/models/service.js";
import Stylist from "../src/models/Stylist.js";
import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  buildCustomerAppointmentOwnershipReadiness,
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
      readiness?.scope ||
      null,
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

async function resolveCanonicalOwnership(
  configuration
) {
  const business =
    await Business.findOne({
      slug:
        configuration.business.slug,
    })
      .select(
        "_id slug businessType status"
      )
      .lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete the canonical tenant bootstrap before Customer/Appointment readiness."
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
      "Canonical active primary Location is missing. Complete the canonical tenant bootstrap before Customer/Appointment readiness."
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
    customers,
    appointments,
    services,
    stylists,
    customerIndexes,
    appointmentIndexes,
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
      Customer.find({})
        .sort({
          _id: 1,
        })
        .select(
          "_id business"
        )
        .lean(),
      Appointment.find({})
        .sort({
          _id: 1,
        })
        .select(
          "_id business location customer service stylist"
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
      Stylist.find({})
        .sort({
          _id: 1,
        })
        .select(
          "_id business"
        )
        .lean(),
      Customer.collection
        .indexes()
        .catch(
          () => []
        ),
      Appointment.collection
        .indexes()
        .catch(
          () => []
        ),
    ]);

  const readiness =
    buildCustomerAppointmentOwnershipReadiness({
      customers,
      appointments,
      services,
      stylists,
      businesses,
      locations,
      businessId:
        business._id,
      locationId:
        location._id,
    });

  const customerCoverage = {
    total:
      customers.length,
    businessScoped:
      customers.filter(
        (customer) =>
          Boolean(
            customer.business
          )
      ).length,
  };

  const appointmentCoverage = {
    total:
      appointments.length,
    businessScoped:
      appointments.filter(
        (appointment) =>
          Boolean(
            appointment.business
          )
      ).length,
    locationScoped:
      appointments.filter(
        (appointment) =>
          Boolean(
            appointment.location
          )
      ).length,
  };

  const report =
    sanitiseCustomerAppointmentReadiness({
      readiness,
      customerCoverage,
      appointmentCoverage,
      customerIndexes,
      appointmentIndexes,
    });

  console.log(
    JSON.stringify(
      report,
      null,
      2
    )
  );

  if (
    !readiness.safeForBackfill
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
