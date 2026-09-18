import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  materialiseNoShowTrainingDataset,
} from "../src/features/aiPlatform/noShowTrainingDatasetService.js";

dotenv.config();

const APPLY = "--apply";
const CONFIRM =
  "--confirm=build-no-show-training-dataset";

function argumentValue(
  name
) {
  const prefix =
    `--${name}=`;

  const match =
    process.argv
      .slice(2)
      .find(
        (value) =>
          String(
            value
          ).startsWith(
            prefix
          )
      );

  return match
    ? String(
        match
      )
        .slice(
          prefix.length
        )
        .trim()
    : "";
}

function mongoUri() {
  const uri =
    String(
      process.env
        .MONGODB_URI ||
        process.env
          .MONGO_URI ||
        ""
    ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required."
    );
  }

  return uri;
}

async function main() {
  const apply =
    process.argv.includes(
      APPLY
    );
  const datasetVersion =
    argumentValue(
      "dataset-version"
    );
  const pseudonymKey =
    String(
      process.env
        .AI_DATASET_PSEUDONYM_KEY ||
        ""
    ).trim();

  if (!datasetVersion) {
    throw new Error(
      "Provide --dataset-version=<version>."
    );
  }

  if (
    pseudonymKey.length <
    32
  ) {
    throw new Error(
      "AI_DATASET_PSEUDONYM_KEY must be configured with at least 32 characters."
    );
  }

  if (
    apply &&
    !process.argv.includes(
      CONFIRM
    )
  ) {
    throw new Error(
      `Applying the dataset build requires ${CONFIRM}.`
    );
  }

  await mongoose.connect(
    mongoUri()
  );

  const result =
    await materialiseNoShowTrainingDataset({
      datasetVersion,
      pseudonymKey,
      apply,
    });

  console.log(
    JSON.stringify(
      {
        mode:
          apply
            ? "apply"
            : "dry-run",
        applied:
          result.applied,
        summary:
          result.summary,
      },
      null,
      2
    )
  );

  console.log(
    apply
      ? "[PASS] No-show training dataset frozen."
      : "[PASS] Dry-run completed. No AI training records were changed."
  );
}

main()
  .catch((error) => {
    console.error(
      "[FAIL] No-show training dataset:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(
    async () => {
      await mongoose.disconnect();
    }
  );
