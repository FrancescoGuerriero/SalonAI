import mongoose from "mongoose";

import {
  startDatabaseJobs,
} from "../jobs/jobLifecycle.js";

const connectDB = async (
  uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI
) => {
  if (!uri || typeof uri !== "string") {
    throw new Error(
      "MONGODB_URI is missing from the backend environment configuration."
    );
  }

  try {
    const connection = await mongoose.connect(
      uri,
      {
        serverSelectionTimeoutMS: 15000,
      }
    );

    console.log(
      `MongoDB Connected: ${connection.connection.host}`
    );

    await startDatabaseJobs();

    return connection;
  } catch (error) {
    console.error(
      `MongoDB connection failed: ${error.message}`
    );

    throw error;
  }
};

export default connectDB;
