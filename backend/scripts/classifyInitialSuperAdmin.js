import "dotenv/config";
import mongoose from "mongoose";

import User from "../src/models/user.js";

const APPLY = "--apply";
const VERIFY = "--verify";
const CONFIRM =
  "--confirm=salonai-initial-super-admin";

function argumentValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv
    .slice(2)
    .find((value) =>
      String(value).startsWith(prefix)
    );

  return match
    ? String(match).slice(prefix.length).trim()
    : "";
}

function mode() {
  const args = process.argv.slice(2);
  const apply = args.includes(APPLY);
  const verify = args.includes(VERIFY);

  if (apply && verify) {
    throw new Error(
      "--apply and --verify cannot be used together."
    );
  }

  if (apply && !args.includes(CONFIRM)) {
    throw new Error(
      `Applying the migration requires ${CONFIRM}.`
    );
  }

  return apply
    ? "apply"
    : verify
      ? "verify"
      : "dry-run";
}

function mongoUri() {
  const uri = String(
    process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      ""
  ).trim();

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required."
    );
  }

  return uri;
}

async function loadCandidate(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error(
      "--user-id must be a valid MongoDB User ID."
    );
  }

  const user = await User.findById(userId)
    .select(
      "name email role isSuperAdmin isActive"
    );

  if (!user) {
    throw new Error(
      "The requested Super Admin account does not exist."
    );
  }

  if (user.role !== "admin") {
    throw new Error(
      "The initial Super Admin candidate must already have the admin role."
    );
  }

  if (user.isActive === false) {
    throw new Error(
      "The initial Super Admin candidate must be active."
    );
  }

  return user;
}

async function main() {
  const selectedMode = mode();
  const userId = argumentValue("user-id");

  if (!userId) {
    throw new Error(
      "Provide the exact account identity with --user-id=<MongoDB User ID>."
    );
  }

  await mongoose.connect(mongoUri());

  const user = await loadCandidate(userId);

  const snapshot = {
    id: String(user._id),
    role: user.role,
    isSuperAdmin:
      user.isSuperAdmin === true,
    isActive:
      user.isActive !== false,
  };

  console.log(
    JSON.stringify(
      {
        mode: selectedMode,
        candidate: snapshot,
        changeRequired:
          user.isSuperAdmin !== true,
      },
      null,
      2
    )
  );

  if (selectedMode === "verify") {
    if (user.isSuperAdmin !== true) {
      throw new Error(
        "Super Admin verification failed: authority flag is not enabled."
      );
    }

    console.log(
      "[PASS] Initial Super Admin authority is present."
    );
    return;
  }

  if (selectedMode === "dry-run") {
    console.log(
      "[PASS] Super Admin dry-run completed. No database changes were made."
    );
    return;
  }

  user.isSuperAdmin = true;
  await user.save();

  const verified =
    await loadCandidate(userId);

  if (
    verified.isSuperAdmin !== true
  ) {
    throw new Error(
      "Super Admin migration verification failed after apply."
    );
  }

  console.log(
    "[PASS] Initial Super Admin authority applied and verified."
  );
}

main()
  .catch((error) => {
    console.error(
      "[FAIL] Super Admin migration:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
