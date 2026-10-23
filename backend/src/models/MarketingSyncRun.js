import mongoose from "mongoose";

const { Schema } = mongoose;

const syncRunSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    source: { type: Schema.Types.ObjectId, ref: "MarketingDataSource", required: true, index: true },
    runKey: { type: String, required: true, trim: true, maxlength: 180 },
    mode: {
      type: String,
      enum: ["preview", "manual", "scheduled", "incremental", "backfill", "seo_scan"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "running", "succeeded", "partial", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    schemaVersion: { type: String, trim: true, default: "1.0.0" },
    requestedWindow: {
      start: { type: Date, default: null },
      end: { type: Date, default: null },
    },
    checkpointBefore: { type: Schema.Types.Mixed, default: () => ({}) },
    checkpointAfter: { type: Schema.Types.Mixed, default: () => ({}) },
    counters: {
      fetched: { type: Number, min: 0, default: 0 },
      rawStored: { type: Number, min: 0, default: 0 },
      normalised: { type: Number, min: 0, default: 0 },
      reconciled: { type: Number, min: 0, default: 0 },
      failed: { type: Number, min: 0, default: 0 },
    },
    retryOf: { type: Schema.Types.ObjectId, ref: "MarketingSyncRun", default: null },
    attempt: { type: Number, min: 1, default: 1 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failureCode: { type: String, trim: true, maxlength: 120, default: "" },
    failureMessage: { type: String, trim: true, maxlength: 2000, default: "" },
    nextRetryAt: { type: Date, default: null, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

syncRunSchema.index({ business: 1, source: 1, runKey: 1 }, { unique: true });
syncRunSchema.index({ business: 1, source: 1, createdAt: -1 });

export default mongoose.models.MarketingSyncRun ||
  mongoose.model("MarketingSyncRun", syncRunSchema);
