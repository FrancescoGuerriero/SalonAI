import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "DataHubDestinationTask", required: true, index: true },
    view: { type: Schema.Types.ObjectId, ref: "DataHubSavedView", required: true, index: true },
    mode: {
      type: String,
      enum: ["preview", "manual", "scheduled", "backfill"],
      default: "preview",
      index: true,
    },
    status: {
      type: String,
      enum: ["previewed", "blocked", "queued", "running", "succeeded", "failed"],
      default: "previewed",
      index: true,
    },
    executionAuthorised: { type: Boolean, default: false },
    rowCount: { type: Number, min: 0, default: 0 },
    checksum: { type: String, trim: true, maxlength: 64, default: "" },
    evidence: { type: Schema.Types.Mixed, default: () => ({}) },
    error: { type: String, trim: true, maxlength: 2000, default: "" },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schema.index({ business: 1, location: 1, task: 1, createdAt: -1 });
schema.index({ business: 1, location: 1, status: 1, createdAt: -1 });

export default mongoose.models.DataHubDestinationRun || mongoose.model("DataHubDestinationRun", schema);
