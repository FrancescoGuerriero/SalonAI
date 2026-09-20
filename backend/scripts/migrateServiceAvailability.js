import dotenv from "dotenv";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

dotenv.config();

const CONFIRM =
  "--confirm=salonai-service-availability-migration";

function modeFrom(
  args = process.argv.slice(2)
) {
  const apply =
    args.includes("--apply");
  const verify =
    args.includes("--verify");

  if (apply && verify) {
    throw new Error(
      "--apply and --verify cannot be combined."
    );
  }

  if (
    apply &&
    !args.includes(CONFIRM)
  ) {
    throw new Error(
      `Applying the service availability migration requires ${CONFIRM}.`
    );
  }

  return apply
    ? "apply"
    : verify
      ? "verify"
      : "dry-run";
}

function mongoUri() {
  const value =
    String(
      process.env.MONGODB_URI ||
        process.env.MONGO_URI ||
        ""
    ).trim();

  if (!value) {
    throw new Error(
      "MONGODB_URI is required."
    );
  }

  return value;
}

async function migrationSummary(
  collection
) {
  const [
    missingPublished,
    missingBookable,
    legacyOnlineBookable,
  ] =
    await Promise.all([
      collection.countDocuments({
        published: {
          $exists: false,
        },
      }),
      collection.countDocuments({
        bookable: {
          $exists: false,
        },
      }),
      collection.countDocuments({
        onlineBookable: {
          $exists: true,
        },
      }),
    ]);

  return {
    missingPublished,
    missingBookable,
    legacyOnlineBookable,
  };
}

async function applyMigration(
  collection
) {
  const cursor =
    collection.find({
      $or: [
        {
          published: {
            $exists: false,
          },
        },
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
    });

  let migrated = 0;

  for await (const service of cursor) {
    const set = {};

    const hadPublished =
      Object.prototype.hasOwnProperty.call(
        service,
        "published"
      );

    if (!hadPublished) {
      // The old active field represented publication.
      set.published =
        service.active !== false;

      // Active now becomes an independent lifecycle state.
      set.active = true;
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        service,
        "bookable"
      )
    ) {
      set.bookable =
        service.onlineBookable !==
        false;
    }

    const update = {};

    if (
      Object.keys(set).length
    ) {
      update.$set = set;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        service,
        "onlineBookable"
      )
    ) {
      update.$unset = {
        onlineBookable: "",
      };
    }

    if (
      Object.keys(update).length
    ) {
      await collection.updateOne(
        {
          _id:
            service._id,
        },
        update
      );
      migrated += 1;
    }
  }

  return migrated;
}

export async function main(
  args = process.argv.slice(2)
) {
  const mode =
    modeFrom(args);

  await mongoose.connect(
    mongoUri()
  );

  const collection =
    mongoose.connection.collection(
      "services"
    );

  const before =
    await migrationSummary(
      collection
    );

  console.log(
    JSON.stringify(
      {
        mode,
        before,
      },
      null,
      2
    )
  );

  if (mode === "dry-run") {
    console.log(
      "[PASS] Service availability migration dry-run completed. No data was changed."
    );
    return;
  }

  if (mode === "apply") {
    const migrated =
      await applyMigration(
        collection
      );

    const after =
      await migrationSummary(
        collection
      );

    console.log(
      JSON.stringify(
        {
          migrated,
          after,
        },
        null,
        2
      )
    );

    if (
      after.missingPublished ||
      after.missingBookable ||
      after.legacyOnlineBookable
    ) {
      throw new Error(
        "Service availability migration verification failed."
      );
    }

    console.log(
      "[PASS] Service availability migration applied and verified."
    );
    return;
  }

  if (
    before.missingPublished ||
    before.missingBookable ||
    before.legacyOnlineBookable
  ) {
    throw new Error(
      "Service availability migration is incomplete."
    );
  }

  console.log(
    "[PASS] Service availability migration is complete."
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
        "[FAIL] Service availability migration:",
        error.message
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
