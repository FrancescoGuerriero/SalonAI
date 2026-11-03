import { writeFile } from "node:fs/promises";

import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  loadNoShowAiCoreManifest,
} from "../src/features/aiPlatform/noShowAiCoreManifestService.js";

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
  const output = argumentValue("output");

  if (!datasetVersion) {
    throw new Error("Provide --dataset-version=<version>.");
  }

  await mongoose.connect(mongoUri());

  const manifest = await loadNoShowAiCoreManifest({
    datasetVersion,
  });
  const serialised = `${JSON.stringify(manifest, null, 2)}\n`;

  if (output) {
    await writeFile(output, serialised, "utf8");
    console.log(`[PASS] AI Core no-show manifest written to ${output}.`);
  } else {
    process.stdout.write(serialised);
  }
}

main()
  .catch((error) => {
    console.error("[FAIL] AI Core no-show manifest export:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
