import mongoose from "mongoose";

/**
 * Observation checkpoint with AES-GCM protected provider cursor.
 * Cursors are opaque internal server state, never exposed via public routes.
 */
const checkpointSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  connection: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationConnection", required: true, index: true },
  provider: { type: String, enum: ["amazon_seller_central", "ebay"], required: true },
  kind: { type: String, enum: ["listings", "orders"], required: true },
  lastObservedAt: { type: Date, required: true },
  stagedCount: { type: Number, min: 0, max: 50, required: true },
  pagesFetched: { type: Number, min: 0, max: 5, default: null },
  sourcePageComplete: { type: Boolean, default: false },
  resumeSupported: { type: Boolean, default: false },
  cursorCiphertext: { type: String, default: "" },
  cursorIv: { type: String, default: "" },
  cursorTag: { type: String, default: "" },
}, { timestamps: true, optimisticConcurrency: true });
checkpointSchema.index({ business: 1, connection: 1, kind: 1 }, { unique: true });

export default mongoose.models.SellerChannelSyncCheckpoint ||
  mongoose.model("SellerChannelSyncCheckpoint", checkpointSchema);
