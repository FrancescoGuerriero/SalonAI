import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  materialiseDemandTrainingDataset,
} from "../src/features/aiPlatform/demandTrainingDatasetService.js";

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
  return process.argv
    .slice(2)
    .includes(`--${name}`);
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
  const datasetVersion = argumentValue("dataset-version");
  const businessId = argumentValue("business-id");
  const locationId = argumentValue("location-id");
  const apply = hasFlag("apply");

  if (!datasetVersion) {
    throw new Error("Provide --dataset-version=<version>.");
  }
  if (!businessId) {
    throw new Error("Provide --business-id=<id>.");
  }
  if (!locationId) {
    throw new Error("Provide --location-id=<id>.");
  }

  await mongoose.connect(mongoUri());

  const result = await materialiseDemandTrainingDataset({
    datasetVersion,
    businessId,
    locationId,
    apply,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!apply) {
    console.log(
      "[DRY RUN] No AI training snapshots or frozen dataset record were written. Re-run with --apply only after reviewing readiness."
    );
  } else {
    console.log(
      "[PASS] Governed demand forecasting dataset frozen for offline AI Core use."
    );
  }
}

main()
  .catch((error) => {
    console.error(
      "[FAIL] Demand AI Core dataset materialisation:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
