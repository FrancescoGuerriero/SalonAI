import dotenv from "dotenv";
import mongoose from "mongoose";

import User from "../src/models/user.js";

dotenv.config();

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

function selectedMode() {
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
      `Applying the Super Admin migration requires ${CONFIRM}.`
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

async function candidateById(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error(
      "--user-id must be the exact MongoDB User ID."
    );
  }

  const user = await User.findById(userId)
    .select(
      "name email role isActive"
    );

  if (!user) {
    throw new Error(
      "No SalonAI user exists for the supplied User ID."
    );
  }

  if (user.isActive === false) {
    throw new Error(
      "The initial Super Admin account must be active."
    );
  }

  if (
    !["admin", "super_admin"].includes(
      user.role
    )
  ) {
    throw new Error(
      "The initial Super Admin candidate must already be an administrator."
    );
  }

  return user;
}

async function inspect(userId) {
  const user = await candidateById(userId);
  const otherSuperAdmins =
    await User.countDocuments({
      _id: { $ne: user._id },
      role: "super_admin",
      isActive: { $ne: false },
    });

  return {
    user,
    otherSuperAdmins,
    alreadyCorrect:
      user.role === "super_admin",
  };
}

async function main() {
  const mode = selectedMode();
  const userId = argumentValue("user-id");

  if (!userId) {
    throw new Error(
      "Provide --user-id=<exact MongoDB User ID>. Email/name lookup is intentionally not supported."
    );
  }

  await mongoose.connect(
    mongoUri()
  );

  const before =
    await inspect(userId);

  console.log(
    JSON.stringify(
      {
        mode,
        candidate: {
          id:
            String(before.user._id),
          role:
            before.user.role,
          isActive:
            before.user.isActive !== false,
        },
        otherActiveSuperAdmins:
          before.otherSuperAdmins,
        changeRequired:
          !before.alreadyCorrect,
      },
      null,
      2
    )
  );

  if (mode === "verify") {
    if (!before.alreadyCorrect) {
      throw new Error(
        "Super Admin verification failed: the selected account is not super_admin."
      );
    }

    console.log(
      "[PASS] Initial Super Admin identity verified."
    );
    return;
  }

  if (mode === "dry-run") {
    console.log(
      "[PASS] Super Admin dry-run completed. No database changes were made."
    );
    return;
  }

  if (
    before.otherSuperAdmins > 0 &&
    !before.alreadyCorrect
  ) {
    throw new Error(
      "Another active Super Admin already exists. Refusing an initial-authority migration."
    );
  }

  if (!before.alreadyCorrect) {
    before.user.role =
      "super_admin";
    await before.user.save();
  }

  const after =
    await inspect(userId);

  if (!after.alreadyCorrect) {
    throw new Error(
      "Super Admin verification failed after apply."
    );
  }

  console.log(
    "[PASS] Initial Super Admin migration applied and verified."
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
