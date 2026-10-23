import mongoose from "mongoose";

const { Schema } = mongoose;

const SOCIAL_CHANNELS = [
  "facebook",
  "instagram",
  "linkedin",
  "google_business_profile",
];

const schema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    campaign: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    campaignExecution: {
      type: Schema.Types.ObjectId,
      ref: "CampaignExecution",
      required: true,
      index: true,
    },
    connection: {
      type: Schema.Types.ObjectId,
      ref: "IntegrationConnection",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: SOCIAL_CHANNELS,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 100,
      index: true,
    },
    content: {
      text: { type: String, trim: true, default: "", maxlength: 10000 },
      linkUrl: { type: String, trim: true, default: "", maxlength: 3000 },
      mediaUrl: { type: String, trim: true, default: "", maxlength: 3000 },
      mediaType: {
        type: String,
        enum: ["none", "image", "video", "document"],
        default: "none",
      },
      altText: { type: String, trim: true, default: "", maxlength: 1000 },
      languageCode: { type: String, trim: true, default: "en-GB", maxlength: 20 },
    },
    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "queued",
        "publishing",
        "published",
        "failed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    scheduledFor: {
      type: Date,
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    externalPostId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
      index: true,
    },
    externalPostUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },
    attemptCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      code: { type: String, trim: true, default: "", maxlength: 200 },
      message: { type: String, trim: true, default: "", maxlength: 2000 },
      at: { type: Date, default: null },
    },
    providerMetadata: {
      type: Schema.Types.Mixed,
      default: {},
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
    optimisticConcurrency: true,
  }
);

schema.index({ business: 1, campaign: 1, channel: 1, createdAt: -1 });
schema.index({ business: 1, status: 1, scheduledFor: 1 });
schema.index(
  { business: 1, idempotencyKey: 1 },
  { unique: true }
);

export { SOCIAL_CHANNELS };
export default mongoose.models.SocialPublication ||
  mongoose.model("SocialPublication", schema);
