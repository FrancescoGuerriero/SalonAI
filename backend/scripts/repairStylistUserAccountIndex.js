import "dotenv/config";
import mongoose from "mongoose";

import Stylist from "../src/models/Stylist.js";

function requireMongoUri() {
  const uri = String(
    process.env.MONGODB_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required to repair the stylist userAccount index."
    );
  }

  return uri;
}

function isUserAccountOnlyIndex(index) {
  const keys = Object.entries(
    index?.key || {}
  );

  return (
    keys.length === 1 &&
    keys[0][0] === "userAccount" &&
    keys[0][1] === 1
  );
}

function isDesiredIndex(index) {
  return (
    isUserAccountOnlyIndex(index) &&
    index.unique === true &&
    index.partialFilterExpression?.userAccount?.$type === "objectId"
  );
}

async function assertNoLinkedAccountDuplicates(collection) {
  const duplicates =
    await collection
      .aggregate([
        {
          $match: {
            userAccount: {
              $type: "objectId",
            },
          },
        },
        {
          $group: {
            _id: "$userAccount",
            count: {
              $sum: 1,
            },
          },
        },
        {
          $match: {
            count: {
              $gt: 1,
            },
          },
        },
        {
          $limit: 1,
        },
      ])
      .toArray();

  if (duplicates.length > 0) {
    throw new Error(
      "Duplicate non-null stylist userAccount links exist. Repair those records before changing the unique index."
    );
  }
}

async function main() {
  await mongoose.connect(
    requireMongoUri()
  );

  const collection =
    mongoose.connection.collection(
      Stylist.collection.name
    );

  await assertNoLinkedAccountDuplicates(
    collection
  );

  const existingIndexes =
    await collection.indexes();

  const userAccountIndexes =
    existingIndexes.filter(
      isUserAccountOnlyIndex
    );

  if (
    userAccountIndexes.length === 1 &&
    isDesiredIndex(
      userAccountIndexes[0]
    )
  ) {
    console.log(
      "[OK] Stylist userAccount index already uses the safe partial unique definition."
    );
  } else {
    for (const index of userAccountIndexes) {
      await collection.dropIndex(
        index.name
      );
      console.log(
        `[OK] Removed legacy stylist index: ${index.name}`
      );
    }

    const cleanup =
      await collection.updateMany(
        {
          userAccount: null,
        },
        {
          $unset: {
            userAccount: "",
          },
        }
      );

    console.log(
      `[OK] Removed explicit null userAccount values from ${cleanup.modifiedCount} stylist record(s).`
    );

    await collection.createIndex(
      {
        userAccount: 1,
      },
      {
        name: "userAccount_1",
        unique: true,
        partialFilterExpression: {
          userAccount: {
            $type: "objectId",
          },
        },
      }
    );

    console.log(
      "[OK] Created partial unique stylist userAccount index."
    );
  }

  const verification =
    (
      await collection.indexes()
    ).find(
      (index) =>
        index.name ===
        "userAccount_1"
    );

  if (
    !verification ||
    !isDesiredIndex(
      verification
    )
  ) {
    throw new Error(
      "Stylist userAccount index verification failed."
    );
  }

  console.log(
    "[PASS] Stylist userAccount index repair complete."
  );
}

main()
  .catch((error) => {
    console.error(
      "[FAIL] Unable to repair stylist userAccount index:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
