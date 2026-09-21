import "dotenv/config";

import mongoose from "mongoose";

import connectDB from "../src/config/db.js";
import Service from "../src/models/service.js";
import Stylist from "../src/models/Stylist.js";

const APPLY_CONFIRMATION =
  "ASSIGN_ALL_SERVICES_TO_ALL_STYLISTS";

function parseArguments(values) {
  return {
    apply:
      values.includes(
        "--apply"
      ),
  };
}

function sameServiceSet(
  current = [],
  expected = []
) {
  const currentIds =
    current
      .map((value) =>
        String(
          value?._id ||
            value
        )
      )
      .sort();

  const expectedIds =
    expected
      .map((value) =>
        String(value)
      )
      .sort();

  return (
    currentIds.length ===
      expectedIds.length &&
    currentIds.every(
      (value, index) =>
        value ===
        expectedIds[index]
    )
  );
}

async function run() {
  const options =
    parseArguments(
      process.argv.slice(2)
    );

  await connectDB();

  const [
    services,
    stylists,
  ] =
    await Promise.all([
      Service.find({})
        .select(
          "_id name"
        )
        .sort({
          name: 1,
        })
        .lean(),
      Stylist.find({})
        .select(
          "_id firstName lastName email services"
        )
        .sort({
          firstName: 1,
          lastName: 1,
        })
        .lean(),
    ]);

  if (
    services.length === 0
  ) {
    throw new Error(
      "No services exist. Nothing can be assigned."
    );
  }

  if (
    stylists.length === 0
  ) {
    throw new Error(
      "No stylists exist. Nothing can be assigned."
    );
  }

  const serviceIds =
    services.map(
      (service) =>
        service._id
    );

  const pending =
    stylists.filter(
      (stylist) =>
        !sameServiceSet(
          stylist.services,
          serviceIds
        )
    );

  console.log(
    JSON.stringify(
      {
        mode:
          options.apply
            ? "apply"
            : "dry-run",
        services:
          services.map(
            (service) => ({
              id:
                String(
                  service._id
                ),
              name:
                service.name,
            })
          ),
        stylistCount:
          stylists.length,
        alreadyAssigned:
          stylists.length -
          pending.length,
        toUpdate:
          pending.map(
            (stylist) => ({
              id:
                String(
                  stylist._id
                ),
              name:
                [
                  stylist.firstName,
                  stylist.lastName,
                ]
                  .filter(Boolean)
                  .join(" "),
              email:
                stylist.email ||
                "",
              previousServiceCount:
                Array.isArray(
                  stylist.services
                )
                  ? stylist
                      .services
                      .length
                  : 0,
              newServiceCount:
                serviceIds.length,
            })
          ),
      },
      null,
      2
    )
  );

  if (
    !options.apply
  ) {
    console.log(
      "Dry-run only. Re-run with --apply and STYLIST_SERVICE_ASSIGNMENT_CONFIRM=ASSIGN_ALL_SERVICES_TO_ALL_STYLISTS to write changes."
    );
    return;
  }

  if (
    process.env
      .STYLIST_SERVICE_ASSIGNMENT_CONFIRM !==
    APPLY_CONFIRMATION
  ) {
    throw new Error(
      "Refusing to assign services without STYLIST_SERVICE_ASSIGNMENT_CONFIRM=ASSIGN_ALL_SERVICES_TO_ALL_STYLISTS."
    );
  }

  const result =
    await Stylist.updateMany(
      {},
      {
        $set: {
          services:
            serviceIds,
        },
      },
      {
        runValidators: true,
      }
    );

  const remaining =
    (
      await Stylist.find({})
        .select(
          "_id services"
        )
        .lean()
    ).filter(
      (stylist) =>
        !sameServiceSet(
          stylist.services,
          serviceIds
        )
    );

  if (
    remaining.length >
    0
  ) {
    throw new Error(
      `Verification failed: ${remaining.length} stylist(s) do not have every service assigned.`
    );
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        matched:
          result.matchedCount,
        modified:
          result.modifiedCount,
        stylistCount:
          stylists.length,
        serviceCount:
          serviceIds.length,
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    console.error(
      "[FAIL] Assign all services to all stylists:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose
      .disconnect()
      .catch(() => {});
  });
