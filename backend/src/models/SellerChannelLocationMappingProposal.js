import mongoose from "mongoose";

/**
 * Operator-nominated SKU / location candidate only. No provider stock-location
 * provenance is present in the current staged listing records. This model
 * therefore has no approved/verified state and is never a stock authority.
 */
const schema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true,
  },
  connection: {
    type: mongoose.Schema.Types.ObjectId, ref: "IntegrationConnection", required: true,
  },
  provider: {
    type: String, required: true, enum: ["amazon_seller_central", "ebay"],
  },
  externalListingId: { type: String, required: true, trim: true, maxlength: 200 },
  sourceSku: { type: String, required: true, trim: true, uppercase: true, maxlength: 200 },
  commerceProduct: {
    type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true,
  },
  commerceLocation: {
    type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true,
  },
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sourceObservedAt: { type: Date, required: true },
  reviewStatus: {
    type: String, required: true, enum: ["pending_provider_location_evidence"],
    default: "pending_provider_location_evidence",
  },
  evidenceSource: {
    type: String, required: true, enum: ["operator_candidate"],
    default: "operator_candidate",
  },
}, { timestamps: true, optimisticConcurrency: true });

// Prevent two operators from creating conflicting candidates for the same
// marketplace listing. The index must be deployed before this endpoint is used.
schema.index(
  { business: 1, connection: 1, externalListingId: 1 },
  { unique: true, name: "seller_location_mapping_candidate_unique" },
);

export default mongoose.models.SellerChannelLocationMappingProposal ||
  mongoose.model("SellerChannelLocationMappingProposal", schema);
