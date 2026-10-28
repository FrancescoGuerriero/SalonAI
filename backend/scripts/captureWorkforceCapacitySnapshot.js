import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  captureWorkforceCapacitySnapshot,
} from "../src/features/aiPlatform/workforceCapacitySnapshotService.js";

dotenv.config();

function argumentValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv
    .slice(2)
    .find((value) => String(value).startsWith(prefix));

  return match
    ? String(match).slice(prefix.length).trim()
    : "";
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

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

async function main() {
  const businessId = argumentValue("business-id");
  const locationId = argumentValue("location-id");
  const businessDate = argumentValue("business-date");
  const apply = hasFlag("apply");

  if (!businessId) {
    throw new Error("Provide --business-id=<id>.");
  }
  if (!locationId) {
    throw new Error("Provide --location-id=<id>.");
  }
  if (!businessDate) {
    throw new Error("Provide --business-date=YYYY-MM-DD.");
  }

  await mongoose.connect(mongoUri());

  const result = await captureWorkforceCapacitySnapshot({
    businessId,
    locationId,
    businessDate,
    apply,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!apply) {
    console.log(
      "[DRY RUN] No workforce capacity snapshot was written. Re-run with --apply after review."
    );
  } else {
    console.log(
      "[PASS] Governed workforce capacity snapshot captured."
    );
  }
}

main()
  .catch((error) => {
    console.error(
      "[FAIL] Workforce capacity snapshot capture:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
