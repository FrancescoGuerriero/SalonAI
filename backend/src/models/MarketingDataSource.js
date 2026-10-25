import mongoose from "mongoose";

const { Schema } = mongoose;

const fieldSchema = new Schema(
  {
    sourceField: { type: String, required: true, trim: true, maxlength: 160 },
    label: { type: String, trim: true, maxlength: 180, default: "" },
    dataType: {
      type: String,
      enum: ["string", "number", "boolean", "date", "datetime", "object", "array"],
      default: "string",
    },
    role: {
      type: String,
      enum: ["identifier", "dimension", "metric", "timestamp", "attribute", "ignored"],
      default: "attribute",
    },
    normalisedField: { type: String, trim: true, maxlength: 160, default: "" },
    required: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false }
);

export const MARKETING_DATA_PROVIDERS = Object.freeze([
  "ga4",
  "google_search_console",
  "bing_webmaster",
  "google_ads",
  "meta_ads",
  "linkedin_ads",
  "microsoft_ads",
  "tiktok_ads",
  "facebook_pages",
  "instagram_organic",
  "linkedin_pages",
  "google_business_profile",
  "shopify",
  "stripe",
  "hubspot",
  "mailchimp",
  "youtube_analytics",
  "generic",
  "technical_seo",
]);

const sourceSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    app: { type: Schema.Types.ObjectId, ref: "IntegrationApp", required: true, index: true },
    connection: { type: Schema.Types.ObjectId, ref: "IntegrationConnection", default: null, index: true },
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    provider: {
      type: String,
      enum: MARKETING_DATA_PROVIDERS,
      required: true,
      index: true,
    },
    providerSchemaVersion: { type: String, required: true, trim: true, default: "1.0.0" },
    status: {
      type: String,
      enum: ["draft", "ready", "active", "paused", "degraded", "error", "archived"],
      default: "draft",
      index: true,
    },
    syncMode: {
      type: String,
      enum: ["manual", "scheduled", "incremental"],
      default: "manual",
    },
    schedule: {
      cadence: { type: String, enum: ["manual", "hourly", "daily", "weekly"], default: "manual" },
      timezone: { type: String, trim: true, maxlength: 80, default: "Europe/London" },
      nextRunAt: { type: Date, default: null, index: true },
    },
    checkpoint: {
      cursor: { type: String, trim: true, maxlength: 2000, default: "" },
      watermark: { type: Date, default: null },
      updatedAt: { type: Date, default: null },
    },
    fieldCatalogue: { type: [fieldSchema], default: [] },
    sourceConfig: { type: Schema.Types.Mixed, default: () => ({}) },
    normalisationConfig: { type: Schema.Types.Mixed, default: () => ({}) },
    lastPreviewAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null, index: true },
    lastSuccessAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    lastError: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

sourceSchema.index({ business: 1, key: 1 }, { unique: true });
sourceSchema.index({ business: 1, provider: 1, status: 1 });

export default mongoose.models.MarketingDataSource ||
  mongoose.model("MarketingDataSource", sourceSchema);
