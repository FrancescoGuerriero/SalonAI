import mongoose from "mongoose";

const { Schema } = mongoose;

const issueSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, maxlength: 120 },
    severity: { type: String, enum: ["info", "warning", "error"], default: "warning" },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    source: { type: Schema.Types.ObjectId, ref: "MarketingDataSource", required: true, index: true },
    run: { type: Schema.Types.ObjectId, ref: "MarketingSyncRun", required: true, index: true },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
    finalUrl: { type: String, required: true, trim: true, maxlength: 2000 },
    statusCode: { type: Number, min: 100, max: 599, required: true },
    contentType: { type: String, trim: true, maxlength: 200, default: "" },
    title: { type: String, trim: true, maxlength: 500, default: "" },
    metaDescription: { type: String, trim: true, maxlength: 1000, default: "" },
    canonicalUrl: { type: String, trim: true, maxlength: 2000, default: "" },
    robots: { type: String, trim: true, maxlength: 500, default: "" },
    noindex: { type: Boolean, default: false },
    h1: { type: [String], default: [] },
    internalLinks: { type: [String], default: [] },
    issues: { type: [issueSchema], default: [] },
    latencyMs: { type: Number, min: 0, default: null },
    scannedAt: { type: Date, required: true, default: Date.now, index: true },
    schemaVersion: { type: String, trim: true, default: "1.0.0" },
  },
  { timestamps: true }
);

schema.index({ business: 1, location: 1, source: 1, run: 1, url: 1 }, { unique: true });
schema.index({ business: 1, location: 1, source: 1, scannedAt: -1 });

export default mongoose.models.SeoPageObservation || mongoose.model("SeoPageObservation", schema);
