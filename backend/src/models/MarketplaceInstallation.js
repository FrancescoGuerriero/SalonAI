import mongoose from "mongoose";

const { Schema } = mongoose;

export const MARKETPLACE_INSTALLATION_STATUSES = Object.freeze([
  "prepared",
  "connected",
  "suspended",
  "uninstalled",
]);

const marketplaceInstallationSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    marketplaceApp: {
      type: Schema.Types.ObjectId,
      ref: "MarketplaceApp",
      required: true,
      index: true,
    },
    integrationApp: {
      type: Schema.Types.ObjectId,
      ref: "IntegrationApp",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: MARKETPLACE_INSTALLATION_STATUSES,
      default: "prepared",
      index: true,
    },
    grantedScopes: { type: [String], default: [] },
    entitlementSnapshot: { type: [String], default: [] },
    commercialSnapshot: {
      billingModel: { type: String, trim: true, default: "free" },
      currency: { type: String, trim: true, uppercase: true, default: "GBP" },
      monthlyAmount: { type: Number, min: 0, default: 0 },
      revenueSharePercent: { type: Number, min: 0, max: 100, default: 0 },
    },
    billingExecutionEnabled: {
      type: Boolean,
      default: false,
      immutable: true,
    },
    connectionProvisioned: {
      type: Boolean,
      default: false,
      immutable: true,
    },
    preparedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    preparedAt: { type: Date, default: Date.now },
    connectedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

marketplaceInstallationSchema.index(
  { business: 1, marketplaceApp: 1 },
  { unique: true }
);
marketplaceInstallationSchema.index({ business: 1, status: 1, updatedAt: -1 });

export default (
  mongoose.models.MarketplaceInstallation ||
  mongoose.model("MarketplaceInstallation", marketplaceInstallationSchema)
);
