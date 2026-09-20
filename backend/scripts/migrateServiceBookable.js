import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const APPLY = "--apply";
const CONFIRM = "--confirm=salonai-service-bookable-migration";

function mongoUri() {
  const uri = String(
    process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      ""
  ).trim();

  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }

  return uri;
}

function targetBookable(document) {
  if (typeof document.bookable === "boolean") {
    return document.bookable;
  }

  if (
    typeof document.onlineBookable ===
    "boolean"
  ) {
    return document.onlineBookable;
  }

  return true;
}

async function main(args = process.argv.slice(2)) {
  const apply = args.includes(APPLY);

  if (
    apply &&
    !args.includes(CONFIRM)
  ) {
    throw new Error(
      `Applying the service bookable migration requires ${CONFIRM}.`
    );
  }

  await mongoose.connect(mongoUri());

  const collection =
    mongoose.connection.collection(
      "services"
    );

  const candidates =
    await collection
      .find(
        {
          $or: [
            {
              bookable: {
                $exists: false,
              },
            },
            {
              onlineBookable: {
                $exists: true,
              },
            },
          ],
        },
        {
          projection: {
            _id: 1,
            name: 1,
            bookable: 1,
            onlineBookable: 1,
          },
        }
      )
      .toArray();

  const summary = candidates.map(
    (service) => ({
      id: String(service._id),
      name: service.name || "",
      previousBookable:
        service.bookable,
      legacyOnlineBookable:
        service.onlineBookable,
      nextBookable:
        targetBookable(service),
    })
  );

  console.log(
    JSON.stringify(
      {
        mode:
          apply
            ? "apply"
            : "dry-run",
        matched:
          candidates.length,
        services:
          summary,
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log(
      "[PASS] Service bookable migration dry-run completed. No database changes were made."
    );
    return;
  }

  if (candidates.length) {
    await collection.bulkWrite(
      candidates.map(
        (service) => ({
          updateOne: {
            filter: {
              _id:
                service._id,
            },
            update: {
              $set: {
                bookable:
                  targetBookable(
                    service
                  ),
              },
              $unset: {
                onlineBookable:
                  "",
              },
            },
          },
        })
      ),
      {
        ordered: true,
      }
    );
  }

  const remainingLegacy =
    await collection.countDocuments({
      onlineBookable: {
        $exists: true,
      },
    });

  const missingBookable =
    await collection.countDocuments({
      bookable: {
        $exists: false,
      },
    });

  if (
    remainingLegacy !== 0 ||
    missingBookable !== 0
  ) {
    throw new Error(
      `Migration verification failed: legacy=${remainingLegacy}, missingBookable=${missingBookable}.`
    );
  }

  console.log(
    "[PASS] Service bookable migration applied and verified."
  );
}

main()
  .catch((error) => {
    console.error(
      "[FAIL] Service bookable migration:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
