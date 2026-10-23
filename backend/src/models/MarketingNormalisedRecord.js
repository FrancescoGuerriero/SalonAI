import mongoose from "mongoose";

const { Schema } = mongoose;

const normalisedRecordSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    source: { type: Schema.Types.ObjectId, ref: "MarketingDataSource", required: true, index: true },
    run: { type: Schema.Types.ObjectId, ref: "MarketingSyncRun", required: true, index: true },
    rawRecord: { type: Schema.Types.ObjectId, ref: "MarketingRawRecord", required: true, index: true },
    entityType: {
      type: String,
      enum: ["analytics_event", "search_performance", "seo_page", "generic_record"],
      required: true,
      index: true,
    },
    externalId: { type: String, required: true, trim: true, maxlength: 500 },
    occurredAt: { type: Date, default: null, index: true },
    schemaVersion: { type: String, trim: true, default: "1.0.0" },
    dimensions: { type: Schema.Types.Mixed, default: () => ({}) },
    metrics: { type: Schema.Types.Mixed, default: () => ({}) },
    attributes: { type: Schema.Types.Mixed, default: () => ({}) },
    lineage: {
      provider: { type: String, trim: true, maxlength: 80, required: true },
      sourceKey: { type: String, trim: true, maxlength: 120, required: true },
      rawPayloadHash: { type: String, trim: true, maxlength: 64, required: true },
      providerSchemaVersion: { type: String, trim: true, maxlength: 40, required: true },
      mappingVersion: { type: String, trim: true, maxlength: 40, default: "1.0.0" },
    },
  },
  { timestamps: true }
);

normalisedRecordSchema.index(
  { business: 1, source: 1, rawRecord: 1, schemaVersion: 1 },
  { unique: true }
);
normalisedRecordSchema.index({ business: 1, entityType: 1, occurredAt: -1 });

export default mongoose.models.MarketingNormalisedRecord ||
  mongoose.model("MarketingNormalisedRecord", normalisedRecordSchema);
