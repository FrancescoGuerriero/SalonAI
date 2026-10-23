import mongoose from "mongoose";

const { Schema } = mongoose;

export const MARKETPLACE_APP_STATUSES = Object.freeze([
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "suspended",
]);

export const MARKETPLACE_BILLING_MODELS = Object.freeze([
  "free",
  "fixed_subscription",
  "usage",
  "revenue_share",
]);

const marketplaceAppSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    partnerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: MARKETPLACE_APP_STATUSES,
      default: "submitted",
      index: true,
    },
    requestedScopes: { type: [String], default: [] },
    approvedScopes: { type: [String], default: [] },
    requiredEntitlements: { type: [String], default: [] },
    integrationProfile: {
      redirectUris: { type: [String], default: [] },
      allowedOrigins: { type: [String], default: [] },
      ratePolicy: {
        requests: { type: Number, min: 1, max: 1000000, default: 600 },
        windowSeconds: { type: Number, min: 1, max: 86400, default: 60 },
      },
    },
    commercialTerms: {
      billingModel: {
        type: String,
        enum: MARKETPLACE_BILLING_MODELS,
        default: "free",
      },
      currency: {
        type: String,
        trim: true,
        uppercase: true,
        default: "GBP",
        minlength: 3,
        maxlength: 3,
      },
      monthlyAmount: { type: Number, min: 0, default: 0 },
      revenueSharePercent: { type: Number, min: 0, max: 100, default: 0 },
    },
    billingExecutionEnabled: {
      type: Boolean,
      default: false,
      immutable: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, default: "", maxlength: 2000 },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

marketplaceAppSchema.index({ status: 1, name: 1 });

export default (
  mongoose.models.MarketplaceApp ||
  mongoose.model("MarketplaceApp", marketplaceAppSchema)
);
