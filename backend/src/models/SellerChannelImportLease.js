import mongoose from "mongoose";

/**
 * A conservative, fail-closed import lease. The TTL index removes abandoned
 * leases after expiry; no other operator can forcibly steal an active lease.
 * Each bounded seller request is limited to 5 pages with 12s/page timeout.
 */
const leaseSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  connection: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationConnection", required: true, index: true },
  kind: { type: String, enum: ["listings", "orders"], required: true },
  owner: { type: String, required: true, maxlength: 80 },
  acquiredAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { timestamps: false });
leaseSchema.index({ business: 1, connection: 1, kind: 1 }, { unique: true });
leaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.SellerChannelImportLease ||
  mongoose.model("SellerChannelImportLease", leaseSchema);
