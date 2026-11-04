import mongoose from "mongoose";

const { Schema } = mongoose;

// Evidence only: acquisition and live verification must be implemented through
// approved provider adapters, not by invoking network requests from this model.
const backlinkObservationSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    source: { type: Schema.Types.ObjectId, ref: "MarketingDataSource", default: null, index: true },
    placement: { type: Schema.Types.ObjectId, ref: "MarketingEditorialPlacement", default: null },
    sourceUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    targetUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    sourceHost: { type: String, required: true, lowercase: true, trim: true, maxlength: 255 },
    anchorText: { type: String, trim: true, maxlength: 1000, default: "" },
    rel: { type: [String], enum: ["nofollow", "sponsored", "ugc", "noopener", "noreferrer"], default: [] },
    discoveryMethod: { type: String, enum: ["manual", "provider_import", "editorial_verification"], required: true },
    externalId: { type: String, trim: true, maxlength: 512, default: "" },
    evidenceHash: { type: String, trim: true, maxlength: 64, default: "" },
    observedAt: { type: Date, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    status: { type: String, enum: ["observed", "verified", "lost", "unavailable"], default: "observed" },
    httpStatus: { type: Number, min: 100, max: 599, default: null },
    verifiedAt: { type: Date, default: null },
    verificationMethod: { type: String, enum: ["none", "manual", "approved_crawler", "provider"], default: "none" },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

backlinkObservationSchema.index({ business: 1, location: 1, targetUrl: 1, observedAt: -1 });
backlinkObservationSchema.index({ business: 1, location: 1, sourceHost: 1, observedAt: -1 });
backlinkObservationSchema.index({ business: 1, location: 1, status: 1, lastSeenAt: -1 });

export default mongoose.models.MarketingBacklinkObservation ||
  mongoose.model("MarketingBacklinkObservation", backlinkObservationSchema);
