import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import mongoose from "mongoose";

import Stylist from "../src/models/Stylist.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const dataPath = path.resolve(
  currentDirectory,
  "../data/demo-stylists.json"
);

function requireMongoUri() {
  const uri = String(
    process.env.MONGODB_URI || ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required to seed demo stylists."
    );
  }

  return uri;
}

async function readProfiles() {
  const text = await fs.readFile(
    dataPath,
    "utf8"
  );
  const profiles = JSON.parse(
    text
  );

  if (
    !Array.isArray(profiles) ||
    profiles.length !== 5
  ) {
    throw new Error(
      "The demo stylist catalogue must contain exactly five profiles."
    );
  }

  return profiles;
}

async function main() {
  const profiles =
    await readProfiles();

  await mongoose.connect(
    requireMongoUri()
  );

  let created = 0;
  let updated = 0;

  for (const profile of profiles) {
    const existing =
      await Stylist.findOne({
        email:
          String(
            profile.email
          )
            .trim()
            .toLowerCase(),
      });

    if (existing) {
      Object.assign(
        existing,
        profile
      );
      await existing.save();
      updated += 1;
      continue;
    }

    await Stylist.create(
      profile
    );
    created += 1;
  }

  console.log(
    `Demo stylist seed complete. Created: ${created}; updated: ${updated}; total: ${profiles.length}.`
  );
}

main()
  .catch((error) => {
    console.error(
      "Unable to seed demo stylists:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
