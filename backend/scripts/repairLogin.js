import "dotenv/config";

import bcrypt from "bcrypt";
import mongoose from "mongoose";

import User from "../src/models/user.js";

function requiredEnvironmentValue(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing environment variable: ${names.join(" or ")}`
  );
}

function safeConnectionDetails() {
  return {
    host:
      mongoose.connection.host ||
      "unknown",

    database:
      mongoose.connection.name ||
      "unknown",
  };
}

async function main() {
  const emailArgument =
    process.argv[2];

  const shouldReset =
    process.argv.includes("--reset");

  const shouldActivate =
    process.argv.includes("--activate");

  if (!emailArgument) {
    throw new Error(
      [
        "Email argument is required.",
        "",
        "Examples:",
        'node scripts/repairLogin.js "user@example.com"',
        'node scripts/repairLogin.js "user@example.com" --reset',
      ].join("\n")
    );
  }

  const normalisedEmail =
    String(emailArgument)
      .trim()
      .toLowerCase();

  const mongoUri =
    requiredEnvironmentValue(
      "MONGODB_URI",
      "MONGO_URI"
    );

  await mongoose.connect(mongoUri);

  const connection =
    safeConnectionDetails();

  console.log("");
  console.log("SalonAI login diagnostic");
  console.log("-------------------------");
  console.log(
    `MongoDB host: ${connection.host}`
  );
  console.log(
    `MongoDB database: ${connection.database}`
  );
  console.log(
    `Email: ${normalisedEmail}`
  );

  const user =
    await User.findOne({
      email: normalisedEmail,
    }).select("+password");

  if (!user) {
    console.log("");
    console.log("USER_FOUND: false");
    console.log(
      "The account does not exist in the database currently used by backend/.env."
    );

    process.exitCode = 2;
    return;
  }

  console.log("");
  console.log("USER_FOUND: true");
  console.log(
    `USER_ID: ${user._id}`
  );
  console.log(
    `ROLE: ${user.role || "unknown"}`
  );
  console.log(
    `ACTIVE: ${user.isActive !== false}`
  );
  console.log(
    `PASSWORD_FIELD_PRESENT: ${Boolean(user.password)}`
  );

  const looksLikeBcrypt =
    typeof user.password === "string" &&
    /^\$2[aby]\$\d{2}\$/.test(
      user.password
    );

  console.log(
    `PASSWORD_HASH_VALID_FORMAT: ${looksLikeBcrypt}`
  );

  const suppliedPassword =
    process.env.LOGIN_PASSWORD || "";

  if (suppliedPassword) {
    const matches =
      looksLikeBcrypt
        ? await bcrypt.compare(
            suppliedPassword,
            user.password
          )
        : false;

    console.log(
      `PASSWORD_MATCH: ${matches}`
    );
  } else {
    console.log(
      "PASSWORD_MATCH: not checked"
    );
  }

  if (shouldActivate) {
    user.isActive = true;

    await user.save({
      validateModifiedOnly: true,
    });

    console.log(
      "ACCOUNT_ACTIVATED: true"
    );
  }

  if (shouldReset) {
    if (
      !suppliedPassword ||
      suppliedPassword.length < 6
    ) {
      throw new Error(
        "LOGIN_PASSWORD must contain at least six characters when --reset is used."
      );
    }

    /*
     * updateOne is used deliberately so a model
     * pre-save hook cannot hash the new password twice.
     */
    const passwordHash =
      await bcrypt.hash(
        suppliedPassword,
        12
      );

    await User.updateOne(
      {
        _id: user._id,
      },
      {
        $set: {
          password:
            passwordHash,

          passwordChangedAt:
            new Date(),

          isActive: true,
        },
      }
    );

    const updatedUser =
      await User.findById(
        user._id
      ).select("+password");

    const verified =
      await bcrypt.compare(
        suppliedPassword,
        updatedUser.password
      );

    console.log(
      `PASSWORD_RESET: ${verified}`
    );
    console.log(
      "ACCOUNT_ACTIVATED: true"
    );
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "Login diagnostic failed:"
    );

    console.error(
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });