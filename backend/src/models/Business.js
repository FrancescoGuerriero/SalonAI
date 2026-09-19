import mongoose from "mongoose";

import {
  DEFAULT_VERTICAL_ID,
  isRegisteredVertical,
} from "../platform/verticals/verticalRegistry.js";

const { Schema } = mongoose;

export const BUSINESS_STATUSES = Object.freeze([
  "trial",
  "active",
  "suspended",
  "archived",
]);

export const SUBSCRIPTION_STATUSES = Object.freeze([
  "trialing",
  "active",
  "past_due",
  "paused",
  "cancelled",
]);

const brandingSchema = new Schema(
  {
    displayName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2048,
    },
    primaryColour: {
      type: String,
      trim: true,
      default: "",
      maxlength: 32,
    },
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    timezone: {
      type: String,
      trim: true,
      default: "Europe/London",
      maxlength: 80,
    },
    locale: {
      type: String,
      trim: true,
      default: "en-GB",
      maxlength: 35,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "GBP",
      minlength: 3,
      maxlength: 3,
    },
  },
  { _id: false }
);

const subscriptionSchema = new Schema(
  {
    planCode: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: "trialing",
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      default: "stripe",
      maxlength: 40,
    },
    customerId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },
    subscriptionId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 255,
    },
  },
  { _id: false }
);

const businessSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Business name is required."],
      trim: true,
      maxlength: [120, "Business name cannot exceed 120 characters."],
    },

    slug: {
      type: String,
      required: [true, "Business slug is required."],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 80,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Business slug may contain lowercase letters, numbers and single hyphens.",
      ],
    },

    businessType: {
      type: String,
      required: true,
      default: DEFAULT_VERTICAL_ID,
      trim: true,
      lowercase: true,
      index: true,
      validate: {
        validator: isRegisteredVertical,
        message: "Business type is not registered in the platform vertical registry.",
      },
    },

    status: {
      type: String,
      enum: BUSINESS_STATUSES,
      default: "trial",
      index: true,
    },

    branding: {
      type: brandingSchema,
      default: () => ({}),
    },

    settings: {
      type: settingsSchema,
      default: () => ({}),
    },

    subscription: {
      type: subscriptionSchema,
      default: () => ({}),
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

businessSchema.index({
  businessType: 1,
  status: 1,
});

businessSchema.index({
  "subscription.status": 1,
});

const Business =
  mongoose.models.Business ||
  mongoose.model("Business", businessSchema);

export default Business;
