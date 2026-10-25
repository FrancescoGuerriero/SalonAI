import mongoose from "mongoose";

const { Schema } = mongoose;

export const DATA_HUB_DESTINATION_TYPES = Object.freeze([
  "google_sheets",
  "excel",
  "bigquery",
  "snowflake",
  "postgresql",
  "mysql",
  "amazon_s3",
  "azure_blob",
  "azure_sql",
  "redshift",
  "databricks",
  "power_bi",
  "looker_studio",
  "tableau",
  "python",
  "mcp_ai",
]);

const fieldMappingSchema = new Schema(
  {
    sourceField: { type: String, required: true, trim: true, maxlength: 180 },
    destinationField: { type: String, required: true, trim: true, maxlength: 180 },
  },
  { _id: false }
);

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    view: { type: Schema.Types.ObjectId, ref: "DataHubSavedView", required: true, index: true },
    app: { type: Schema.Types.ObjectId, ref: "IntegrationApp", default: null, index: true },
    connection: { type: Schema.Types.ObjectId, ref: "IntegrationConnection", default: null, index: true },
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    type: { type: String, enum: DATA_HUB_DESTINATION_TYPES, required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "ready", "active", "paused", "error", "archived"],
      default: "draft",
      index: true,
    },
    format: { type: String, enum: ["json", "csv", "table"], default: "table" },
    writeMode: { type: String, enum: ["replace", "append", "upsert"], default: "replace" },
    schedule: {
      cadence: { type: String, enum: ["manual", "hourly", "daily", "weekly"], default: "manual" },
      timezone: { type: String, trim: true, maxlength: 80, default: "Europe/London" },
      nextRunAt: { type: Date, default: null, index: true },
    },
    destinationConfig: { type: Schema.Types.Mixed, default: () => ({}) },
    fieldMapping: { type: [fieldMappingSchema], default: [] },
    humanApprovalRequired: { type: Boolean, default: true },
    executionAuthorised: { type: Boolean, default: false },
    lastPreviewAt: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    lastError: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

schema.index({ business: 1, location: 1, key: 1 }, { unique: true });
schema.index({ business: 1, location: 1, status: 1, "schedule.nextRunAt": 1 });

export default mongoose.models.DataHubDestinationTask || mongoose.model("DataHubDestinationTask", schema);
