import mongoose from "mongoose";

const { Schema } = mongoose;

const filterSchema = new Schema(
  {
    field: { type: String, required: true, trim: true, maxlength: 180 },
    operator: {
      type: String,
      enum: ["eq", "neq", "contains", "gt", "gte", "lt", "lte", "in", "not_in"],
      default: "eq",
    },
    value: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const querySchema = new Schema(
  {
    sourceIds: [{ type: Schema.Types.ObjectId, ref: "MarketingDataSource" }],
    entityTypes: [{ type: String, enum: ["analytics_event", "search_performance", "seo_page", "generic_record"] }],
    dateRange: {
      from: { type: Date, default: null },
      to: { type: Date, default: null },
      rollingDays: { type: Number, min: 1, max: 3650, default: null },
    },
    dateGrain: {
      type: String,
      enum: ["none", "day", "week", "month"],
      default: "day",
    },
    dimensions: [{ type: String, trim: true, maxlength: 180 }],
    metrics: [{ type: String, trim: true, maxlength: 180 }],
    calculatedMetrics: [{ type: String, trim: true, maxlength: 80 }],
    filters: { type: [filterSchema], default: [] },
    rowLimit: { type: Number, min: 1, max: 1000, default: 250 },
  },
  { _id: false }
);

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    query: { type: querySchema, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

schema.index({ business: 1, location: 1, key: 1 }, { unique: true });
schema.index({ business: 1, location: 1, status: 1, updatedAt: -1 });

export default mongoose.models.DataHubSavedView || mongoose.model("DataHubSavedView", schema);
