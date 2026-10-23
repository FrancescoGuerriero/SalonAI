import mongoose from "mongoose";

const { Schema } = mongoose;

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
    channel: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 80,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 120,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "queued",
        "running",
        "succeeded",
        "partially_failed",
        "failed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      required: true,
      maxlength: 240,
    },
    externalReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
      index: true,
    },
    scheduledFor: {
      type: Date,
      default: null,
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    metrics: {
      attempted: { type: Number, min: 0, default: 0 },
      delivered: { type: Number, min: 0, default: 0 },
      failed: { type: Number, min: 0, default: 0 },
      opens: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      conversions: { type: Number, min: 0, default: 0 },
      spend: { type: Number, min: 0, default: 0 },
      revenue: { type: Number, min: 0, default: 0 },
      currency: { type: String, trim: true, uppercase: true, default: "GBP", maxlength: 3 },
    },
    metadata: {
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

schema.index({ business: 1, campaign: 1, createdAt: -1 });
schema.index(
  { business: 1, idempotencyKey: 1 },
  { unique: true }
);

export default mongoose.models.CampaignExecution ||
  mongoose.model("CampaignExecution", schema);
