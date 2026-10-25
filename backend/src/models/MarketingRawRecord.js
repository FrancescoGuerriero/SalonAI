import mongoose from "mongoose";

const { Schema } = mongoose;

const rawRecordSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    source: { type: Schema.Types.ObjectId, ref: "MarketingDataSource", required: true, index: true },
    run: { type: Schema.Types.ObjectId, ref: "MarketingSyncRun", required: true, index: true },
    externalId: { type: String, required: true, trim: true, maxlength: 500 },
    payloadHash: { type: String, required: true, trim: true, maxlength: 64 },
    capturedAt: { type: Date, required: true, default: Date.now, index: true },
    sourceUpdatedAt: { type: Date, default: null },
    schemaVersion: { type: String, trim: true, default: "1.0.0" },
    payload: { type: Schema.Types.Mixed, required: true },
    reconciliationStatus: {
      type: String,
      enum: ["pending", "normalised", "skipped", "failed"],
      default: "pending",
      index: true,
    },
    reconciliationMessage: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true }
);

rawRecordSchema.index({ business: 1, location: 1, source: 1, externalId: 1, payloadHash: 1 }, { unique: true });
rawRecordSchema.index({ business: 1, location: 1, run: 1, reconciliationStatus: 1 });

export default mongoose.models.MarketingRawRecord || mongoose.model("MarketingRawRecord", rawRecordSchema);
