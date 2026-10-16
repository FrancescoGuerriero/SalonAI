import mongoose from "mongoose";

import {
  EMPLOYEE_PERMISSIONS,
} from "../constants/permissions.js";

const { Schema } = mongoose;

const staffRoleSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: null,
      index: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      maxlength: 40,
      match: [
        /^[a-z][a-z0-9_]{2,39}$/,
        "Role key must start with a letter and contain only lowercase letters, numbers and underscores.",
      ],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    permissions: {
      type: [
        {
          type: String,
          enum: EMPLOYEE_PERMISSIONS,
        },
      ],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Transitional indexes for #387. The existing global unique key remains in
// place until production ownership backfill and collision analysis are
// complete. A later reviewed migration may replace it with { business, key }
// uniqueness once every persisted role is Business-owned.
staffRoleSchema.index({
  business: 1,
  active: -1,
  name: 1,
});

staffRoleSchema.index({
  business: 1,
  key: 1,
});

staffRoleSchema.index({
  active: 1,
  name: 1,
});

const StaffRole =
  mongoose.models.StaffRole ||
  mongoose.model(
    "StaffRole",
    staffRoleSchema
  );

export default StaffRole;
