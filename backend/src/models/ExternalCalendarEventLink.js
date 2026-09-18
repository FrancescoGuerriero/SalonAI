import mongoose from "mongoose";

const { Schema } = mongoose;

const externalCalendarEventLinkSchema =
  new Schema(
    {
      connection: {
        type: Schema.Types.ObjectId,
        ref: "ExternalCalendarConnection",
        required: true,
        index: true,
      },
      appointment: {
        type: Schema.Types.ObjectId,
        ref: "Appointment",
        required: true,
        index: true,
      },
      provider: {
        type: String,
        enum: [
          "google",
          "outlook",
        ],
        required: true,
        index: true,
      },
      calendarId: {
        type: String,
        required: true,
        trim: true,
      },
      providerEventId: {
        type: String,
        required: true,
        trim: true,
      },
      providerVersion: {
        type: String,
        trim: true,
        default: "",
      },
      payloadHash: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      status: {
        type: String,
        enum: [
          "synced",
          "deleted",
          "error",
        ],
        default: "synced",
        index: true,
      },
      lastSyncedAt: {
        type: Date,
        default: null,
      },
      lastProviderUpdatedAt: {
        type: Date,
        default: null,
      },
      lastError: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: "",
      },
      failureCount: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    {
      timestamps: true,
    }
  );

externalCalendarEventLinkSchema.index(
  {
    connection: 1,
    appointment: 1,
  },
  {
    unique: true,
  }
);

externalCalendarEventLinkSchema.index(
  {
    provider: 1,
    calendarId: 1,
    providerEventId: 1,
  },
  {
    unique: true,
  }
);

const ExternalCalendarEventLink =
  mongoose.models
    .ExternalCalendarEventLink ||
  mongoose.model(
    "ExternalCalendarEventLink",
    externalCalendarEventLinkSchema
  );

export default ExternalCalendarEventLink;
