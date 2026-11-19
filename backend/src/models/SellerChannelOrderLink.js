import mongoose from "mongoose";

const schema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  connection: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationConnection", required: true },
  provider: { type: String, required: true, enum: ["amazon_seller_central", "ebay"] },
  externalOrderId: { type: String, required: true, trim: true, maxlength: 200 },
  commerceOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  // A proposed reference is NOT proof that the existing Commerce Order belongs
  // to the business or corresponds to the marketplace order.
  verificationStatus: {
    type: String, enum: ["pending_verification"], default: "pending_verification",
    required: true,
  },
  evidenceSource: {
    type: String, enum: ["operator_proposal"], default: "operator_proposal",
    required: true,
  },
}, { timestamps: true, optimisticConcurrency: true });

schema.index({ business: 1, connection: 1, externalOrderId: 1 }, { unique: true });
schema.index({ business: 1, commerceOrder: 1 }, { unique: true });

export default mongoose.models.SellerChannelOrderLink ||
  mongoose.model("SellerChannelOrderLink", schema);
