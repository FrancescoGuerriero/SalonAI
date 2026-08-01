import mongoose from "mongoose";
import { createServiceError } from "./serviceError.js";

export function objectId(value, fieldName = "id") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createServiceError(
      `${fieldName} must be a valid MongoDB ID.`,
      400
    );
  }

  return new mongoose.Types.ObjectId(value);
}

export function userId(user) {
  const candidate = user?._id || user?.id;

  return mongoose.Types.ObjectId.isValid(candidate)
    ? candidate
    : undefined;
}

export function escapedRegex(value) {
  return new RegExp(
    String(value || "").replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    ),
    "i"
  );
}
