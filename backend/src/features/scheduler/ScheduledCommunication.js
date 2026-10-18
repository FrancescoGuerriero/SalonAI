import mongoose from "mongoose";

const scheduledCommunicationSchema = new mongoose.Schema(
  {
    // Transitional #479 trusted ownership. These become mandatory only after
    // the guarded production backfill has been accepted.
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    // Location is required for appointment-linked/location-specific work and
    // may be absent for deliberately Business-wide communications.
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: undefined,
      index: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      index: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    communicationType: {
      type: String,
      enum: [
        "campaign",
        "appointment_reminder",
        "follow_up",
        "birthday",
        "general",
      ],
      default: "general",
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp", "phone", "in_app"],
      required: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "queued",
        "processing",
        "sent",
        "delivered",
        "opened",
        "responded",
        "failed",
        "cancelled",
      ],
      default: "queued",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAttemptAt: Date,
    provider: String,
    providerMessageId: String,
    failureReason: String,
    lockedAt: Date,
    lockedBy: String,
    sentAt: Date,
    deliveredAt: Date,
    openedAt: Date,
    respondedAt: Date,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

scheduledCommunicationSchema.index({
  status: 1,
  scheduledFor: 1,
  lockedAt: 1,
});

scheduledCommunicationSchema.index({
  business: 1,
  location: 1,
  status: 1,
  scheduledFor: 1,
});

scheduledCommunicationSchema.index(
  {
    campaign: 1,
    customer: 1,
    channel: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      campaign: { $exists: true },
    },
  }
);

const ScheduledCommunication =
  mongoose.models.ScheduledCommunication ||
  mongoose.model("ScheduledCommunication", scheduledCommunicationSchema);

export default ScheduledCommunication;
