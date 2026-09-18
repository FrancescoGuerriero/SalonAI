import dotenv from "dotenv";
import mongoose from "mongoose";

import User from "../src/models/user.js";

dotenv.config();

async function promoteSuperAdmin() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    throw new Error(
      "Provide the existing owner account email. Example: npm run superadmin:set -- owner@example.com"
    );
  }

  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is missing from the backend environment."
    );
  }

  await mongoose.connect(mongoUri);

  const user = await User.findOne({ email });

  if (!user) {
    throw new Error(
      `No SalonAI user was found with email: ${email}`
    );
  }

  if (user.isActive === false) {
    throw new Error(
      "The selected Super Admin account must be active before promotion."
    );
  }

  const previousRole = user.role;
  user.role = "super_admin";
  await user.save();

  console.log("SalonAI Super Admin promoted:");
  console.log({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    previousRole,
    role: user.role,
  });
}

promoteSuperAdmin()
  .catch((error) => {
    console.error(
      `Unable to promote Super Admin: ${error.message}`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
