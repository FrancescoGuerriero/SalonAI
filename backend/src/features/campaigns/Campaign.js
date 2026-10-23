import mongoose from "mongoose";

const CAMPAIGN_CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "phone",
  "in_app",
  "facebook",
  "instagram",
  "linkedin",
  "google_business_profile",
  "web",
  "other",
];

const campaignSchema = new mongoose.Schema(
  {
    // Legacy records may not yet have ownership. New Point 6 writes require it
    // in the service layer so production backfill remains a separate gate.
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    campaignKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 140,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    objective: {
      type: String,
      enum: [
        "acquisition",
        "conversion",
        "retention",
        "rebooking",
        "reputation",
        "promotion",
        "general",
      ],
      default: "general",
      index: true,
    },
    campaignType: {
      type: String,
      enum: [
        "dormant_customer",
        "appointment_reminder",
        "follow_up",
        "promotion",
        "birthday",
        "lead_acquisition",
        "lead_conversion",
        "reputation",
        "social",
        "general",
      ],
      default: "general",
      index: true,
    },
    // `channel` remains the primary/legacy execution channel. `channels`
    // defines the master campaign's governed cross-channel surface.
    channel: {
      type: String,
      enum: CAMPAIGN_CHANNELS,
      required: true,
      index: true,
    },
    channels: {
      type: [{ type: String, enum: CAMPAIGN_CHANNELS }],
      default: [],
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunicationTemplate",
    },
    segment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerSegment",
    },
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
      },
    ],
    subject: {
      type: String,
      trim: true,
      default: "",
      maxlength: 250,
    },
    message: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    utm: {
      source: { type: String, trim: true, lowercase: true, default: "", maxlength: 160 },
      medium: { type: String, trim: true, lowercase: true, default: "", maxlength: 160 },
      campaign: { type: String, trim: true, default: "", maxlength: 200 },
      term: { type: String, trim: true, default: "", maxlength: 200 },
      content: { type: String, trim: true, default: "", maxlength: 200 },
    },
    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "processing",
        "completed",
        "partially_failed",
        "failed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    startsAt: {
      type: Date,
      default: null,
      index: true,
    },
    endsAt: {
      type: Date,
      default: null,
      index: true,
    },
    startedAt: Date,
    completedAt: Date,
    recipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

campaignSchema.index({
  status: 1,
  scheduledFor: 1,
});

campaignSchema.index({
  business: 1,
  status: 1,
  createdAt: -1,
});

campaignSchema.index(
  {
    business: 1,
    campaignKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      business: { $type: "objectId" },
      campaignKey: { $type: "string", $gt: "" },
    },
  }
);

const Campaign =
  mongoose.models.Campaign ||
  mongoose.model("Campaign", campaignSchema);

export { CAMPAIGN_CHANNELS };
export default Campaign;
