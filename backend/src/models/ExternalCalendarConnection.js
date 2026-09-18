import mongoose from "mongoose";

const { Schema } = mongoose;

const externalCalendarConnectionSchema =
  new Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      provider: {
        type: String,
        enum: ["google", "outlook"],
        required: true,
        index: true,
      },
      providerAccountId: {
        type: String,
        trim: true,
        default: "",
      },
      accountEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },
      accountName: {
        type: String,
        trim: true,
        default: "",
      },
      calendarId: {
        type: String,
        trim: true,
        default: "primary",
      },
      calendarName: {
        type: String,
        trim: true,
        default: "Primary calendar",
      },
      syncEnabled: {
        type: Boolean,
        default: false,
        index: true,
      },
      status: {
        type: String,
        enum: [
          "connected",
          "reauthorization_required",
          "error",
        ],
        default: "connected",
      },
      encryptedAccessToken: {
        type: String,
        select: false,
        default: "",
      },
      encryptedRefreshToken: {
        type: String,
        select: false,
        default: "",
      },
      tokenExpiresAt: {
        type: Date,
        default: null,
      },
      scopes: {
        type: [String],
        default: [],
      },
      syncCursor: {
        type: String,
        select: false,
        default: "",
      },
      subscriptionId: {
        type: String,
        select: false,
        default: "",
      },
      subscriptionResourceId: {
        type: String,
        select: false,
        default: "",
      },
      subscriptionExpiresAt: {
        type: Date,
        default: null,
      },
      reconcileRequestedAt: {
        type: Date,
        default: null,
        index: true,
      },
      lastWebhookAt: {
        type: Date,
        default: null,
      },
      lastSyncedAt: {
        type: Date,
        default: null,
      },
      lastSyncError: {
        type: String,
        trim: true,
        default: "",
        maxlength: 2000,
      },
    },
    {
      timestamps: true,
    }
  );

externalCalendarConnectionSchema.index(
  {
    syncEnabled: 1,
    reconcileRequestedAt: 1,
  }
);

externalCalendarConnectionSchema.index(
  {
    user: 1,
    provider: 1,
  },
  {
    unique: true,
  }
);

const ExternalCalendarConnection =
  mongoose.models.ExternalCalendarConnection ||
  mongoose.model(
    "ExternalCalendarConnection",
    externalCalendarConnectionSchema
  );

export default ExternalCalendarConnection;
