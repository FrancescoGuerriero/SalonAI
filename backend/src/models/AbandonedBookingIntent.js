import mongoose from "mongoose";

const { Schema } = mongoose;

export const BOOKING_RECOVERY_STATUSES = Object.freeze([
  "active",
  "abandoned",
  "recovered",
  "converted",
  "expired",
  "cancelled",
]);

export const BOOKING_RECOVERY_CLASSIFICATIONS = Object.freeze([
  "marketing",
  "transactional",
]);

const abandonedBookingIntentSchema = new Schema(
  {
    // Transitional tenant ownership mirrors Customer/Appointment while #471
    // remains an explicit production migration gate. Never accept this value
    // from an untrusted customer payload.
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: undefined,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceChannel: {
      type: String,
      enum: ["website", "whatsapp", "phone", "staff", "other"],
      default: "website",
      index: true,
    },
    status: {
      type: String,
      enum: BOOKING_RECOVERY_STATUSES,
      default: "active",
      index: true,
    },
    communicationClassification: {
      type: String,
      enum: BOOKING_RECOVERY_CLASSIFICATIONS,
      default: "marketing",
      index: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null,
      index: true,
    },
    stylist: {
      type: Schema.Types.ObjectId,
      ref: "Stylist",
      default: null,
      index: true,
    },
    appointmentDate: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10,
      match: [/^$|^\d{4}-\d{2}-\d{2}$/, "appointmentDate must use YYYY-MM-DD."],
    },
    appointmentTime: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5,
      match: [/^$|^([01]\d|2[0-3]):[0-5]\d$/, "appointmentTime must use HH:mm."],
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    abandonedAt: {
      type: Date,
      default: null,
      index: true,
    },
    recoverableUntil: {
      type: Date,
      default: null,
      index: true,
    },
    recoveredAt: {
      type: Date,
      default: null,
    },
    convertedAt: {
      type: Date,
      default: null,
      index: true,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
      index: true,
    },
    recoveryCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    workflowEventId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

abandonedBookingIntentSchema.index({
  business: 1,
  status: 1,
  lastActivityAt: 1,
});
abandonedBookingIntentSchema.index({
  user: 1,
  status: 1,
  updatedAt: -1,
});
abandonedBookingIntentSchema.index(
  { user: 1, sourceChannel: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  }
);
abandonedBookingIntentSchema.index(
  { appointment: 1 },
  {
    unique: true,
    partialFilterExpression: { appointment: { $type: "objectId" } },
  }
);

export default (
  mongoose.models.AbandonedBookingIntent ||
  mongoose.model("AbandonedBookingIntent", abandonedBookingIntentSchema)
);
