import mongoose from "mongoose";

/**
 * Source-ingestion journal only. This is not a Commerce commit ledger and
 * contains no provider cursor, customer data or credentials.
 */
const schema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  connection: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationConnection", required: true, index: true },
  provider: { type: String, enum: ["amazon_seller_central", "ebay"], required: true },
  kind: { type: String, enum: ["listings", "orders"], required: true },
  runId: { type: String, required: true, immutable: true },
  state: { type: String, enum: [
    "started", "provider_read", "staged", "checkpointed", "completed", "failed",
  ], required: true, default: "started", index: true },
  stagedCount: { type: Number, min: 0, max: 50, default: 0 },
  failureClass: { type: String, enum: ["provider_or_validation", "staging", "checkpoint", "audit", "unknown"], default: undefined },
  startedAt: { type: Date, default: Date.now, required: true },
  finishedAt: { type: Date, default: null },
}, { timestamps: false });
schema.index({ business: 1, connection: 1, kind: 1, startedAt: -1 });
schema.index({ business: 1, runId: 1 }, { unique: true });

export default mongoose.models.SellerChannelImportRun ||
  mongoose.model("SellerChannelImportRun", schema);
