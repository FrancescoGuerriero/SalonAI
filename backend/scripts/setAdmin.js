import dotenv from "dotenv";
import mongoose from "mongoose";

import User from "../src/models/user.js";

dotenv.config();

async function setAdmin() {
  const email = process.argv[2]
    ?.trim()
    .toLowerCase();

  if (!email) {
    throw new Error(
      "Provide the account email address. Example: node scripts/setAdmin.js owner@example.com"
    );
  }

  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is missing from the backend .env file."
    );
  }

  await mongoose.connect(mongoUri);

  const user = await User.findOne({
    email,
  });

  if (!user) {
    throw new Error(
      `No SalonAI user was found with email: ${email}`
    );
  }

  user.role = "admin";
  await user.save();

  console.log("SalonAI administrator updated:");
  console.log({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  });
}

setAdmin()
  .catch((error) => {
    console.error(
      `Unable to update administrator: ${error.message}`
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });