import mongoose from "mongoose";

const schema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  connection: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationConnection", required: true, index: true },
  provider: { type: String, enum: ["amazon_seller_central", "ebay"], required: true },
  kind: { type: String, enum: ["listings", "orders"], required: true },
  externalId: { type: String, required: true, trim: true, maxlength: 200 },
  sourceRecord: {
    sku: { type: String, maxlength: 200, default: "" },
    status: { type: String, maxlength: 120, default: "" },
    quantity: { type: Number, min: 0, default: null },
    placedAt: { type: Date, default: null },
    amount: { type: String, maxlength: 100, default: "" },
    currency: { type: String, maxlength: 20, default: "" },
    fulfillmentStatus: { type: String, maxlength: 120, default: "" },
  },
  lastObservedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true, optimisticConcurrency: true });

schema.index({ business: 1, connection: 1, kind: 1, externalId: 1 }, { unique: true });
schema.index({ business: 1, provider: 1, kind: 1, lastObservedAt: -1 });

export default mongoose.models.SellerChannelStagingRecord ||
  mongoose.model("SellerChannelStagingRecord", schema);
