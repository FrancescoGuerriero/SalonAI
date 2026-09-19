import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  reconcileNoShowInferenceOutcomes,
} from "../src/features/aiPlatform/noShowOutcomeReconciliationService.js";

dotenv.config();

const APPLY =
  "--apply";
const CONFIRM =
  "--confirm=reconcile-no-show-outcomes";

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

  if (
    !uri
  ) {
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

  if (
    apply &&
    !process.argv.includes(
      CONFIRM
    )
  ) {
    throw new Error(
      `Applying outcome reconciliation requires ${CONFIRM}.`
    );
  }

  await mongoose.connect(
    mongoUri()
  );

  const result =
    await reconcileNoShowInferenceOutcomes({
      limit:
        argumentValue(
          "limit"
        ) ||
        500,
      apply,
    });

  console.log(
    JSON.stringify(
      {
        mode:
          apply
            ? "apply"
            : "dry-run",
        ...result,
      },
      null,
      2
    )
  );

  console.log(
    apply
      ? "[PASS] No-show inference outcomes reconciled."
      : "[PASS] Dry-run completed. No inference outcomes were changed."
  );
}

main()
  .catch(
    (error) => {
      console.error(
        "[FAIL] No-show outcome reconciliation:",
        error.message
      );
      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await mongoose.disconnect();
    }
  );
