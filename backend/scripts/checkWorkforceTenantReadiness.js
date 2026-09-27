import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Business from "../src/models/Business.js";
import BusinessMembership from "../src/models/BusinessMembership.js";
import Location from "../src/models/Location.js";
import Stylist from "../src/models/Stylist.js";
import User from "../src/models/user.js";
import StaffAvailability from "../src/features/staff/StaffAvailability.js";
import StaffTimeOff from "../src/features/staff/StaffTimeOff.js";
import StaffShift from "../src/features/staffRota/StaffShift.js";
import StaffAttendance from "../src/features/staffRota/StaffAttendance.js";
import {
  getCanonicalSalonTenantConfiguration,
} from "../src/platform/tenancy/canonicalSalonTenantBootstrap.js";
import {
  buildWorkforceOwnershipReadiness,
} from "../src/platform/tenancy/workforceOwnershipMigration.js";

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
      "MONGODB_URI is required for workforce tenant readiness."
    );
  }

  return uri;
}

export function assertReadOnlyArguments(
  args = process.argv.slice(2)
) {
  const prohibited =
    new Set([
      "--apply",
      "--write",
      "--migrate",
      "--backfill",
      "--fix",
    ]);

  const supplied =
    args.filter(
      (argument) =>
        prohibited.has(
          String(
            argument || ""
          ).trim()
        )
    );

  if (
    supplied.length >
    0
  ) {
    throw new Error(
      `Workforce tenant readiness is read-only. Unsupported write arguments: ${supplied.join(", ")}.`
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

async function coverage(
  Model,
  {
    businessField =
      "business",
    locationField =
      null,
  } = {}
) {
  const total =
    await Model.countDocuments(
      {}
    );

  const businessScoped =
    await Model.countDocuments({
      [businessField]: {
        $exists: true,
        $ne: null,
      },
    });

  const locationScoped =
    locationField
      ? await Model.countDocuments({
          [locationField]: {
            $exists: true,
            $ne: null,
          },
        })
      : null;

  return {
    total,
    businessScoped,
    locationScoped,
  };
}

export function sanitiseWorkforceReadiness({
  plan,
  coverageByDomain,
  indexNames = [],
} = {}) {
  return Object.freeze({
    readOnly: true,
    safeForOwnershipBackfill:
      Boolean(
        plan?.safeForBackfill
      ),
    workforce:
      Object.freeze({
        ...(
          plan?.summary ||
          {}
        ),
        blockerTypes:
          Object.freeze(
            groupedBlockers(
              plan?.blockers
            )
          ),
      }),
    coverage:
      Object.freeze({
        ...(coverageByDomain ||
          {}),
      }),
    legacyUniqueIndexes:
      Object.freeze(
        (
          Array.isArray(
            indexNames
          )
            ? indexNames
            : []
        )
          .filter(
            (name) =>
              [
                "email_1",
                "userAccount_1",
              ].includes(
                String(
                  name || ""
                )
              )
          )
      ),
    piiIncluded: false,
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
      "Canonical Salon AI Business is not present. Complete the canonical tenant bootstrap gate before workforce backfill planning."
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
      "Canonical Salon AI primary Location is not present and active. Complete the canonical tenant bootstrap gate before workforce backfill planning."
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

  const relevantUserIds =
    [
      ...new Set(
        users.map(
          (user) =>
            String(
              user._id
            )
        )
      ),
    ];

  const memberships =
    relevantUserIds.length
      ? await BusinessMembership.find({
          user: {
            $in:
              relevantUserIds,
          },
        })
          .select(
            "_id user business status roleKey locationAccessMode locations"
          )
          .lean()
      : [];

  const plan =
    buildWorkforceOwnershipReadiness({
      stylists,
      users,
      memberships,
      businessId:
        business._id,
      locationId:
        location._id,
    });

  const [
    stylistCoverage,
    availabilityCoverage,
    timeOffCoverage,
    shiftCoverage,
    attendanceCoverage,
    indexes,
  ] =
    await Promise.all([
      coverage(
        Stylist,
        {
          locationField:
            null,
        }
      ).then(
        async (
          result
        ) => ({
          ...result,
          workingLocationScoped:
            await Stylist.countDocuments({
              workingLocations: {
                $exists: true,
                $ne: [],
              },
            }),
        })
      ),
      coverage(
        StaffAvailability,
        {
          locationField:
            "location",
        }
      ),
      coverage(
        StaffTimeOff,
        {
          locationField:
            "location",
        }
      ),
      coverage(
        StaffShift,
        {
          locationField:
            "locationRef",
        }
      ),
      coverage(
        StaffAttendance,
        {
          locationField:
            "locationRef",
        }
      ),
      Stylist.collection
        .indexes()
        .catch(
          () => []
        ),
    ]);

  const report =
    sanitiseWorkforceReadiness({
      plan,
      coverageByDomain: {
        stylists:
          stylistCoverage,
        availability:
          availabilityCoverage,
        timeOff:
          timeOffCoverage,
        shifts:
          shiftCoverage,
        attendance:
          attendanceCoverage,
      },
      indexNames:
        indexes.map(
          (index) =>
            index.name
        ),
    });

  console.log(
    JSON.stringify(
      {
        ...report,
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
    !plan.safeForBackfill
  ) {
    process.exitCode = 2;
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
          "[FAIL] Workforce tenant readiness:",
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
