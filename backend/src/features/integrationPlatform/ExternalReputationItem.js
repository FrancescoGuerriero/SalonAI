import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", default: null, index: true },
    app: { type: Schema.Types.ObjectId, ref: "IntegrationApp", required: true, index: true },
    connection: { type: Schema.Types.ObjectId, ref: "IntegrationConnection", required: true, index: true },
    provider: {
      type: String,
      enum: ["google_business_profile", "generic_review"],
      required: true,
      index: true,
    },
    externalId: { type: String, required: true, trim: true, maxlength: 500 },
    listingExternalId: { type: String, trim: true, default: "", maxlength: 500, index: true },
    reviewer: {
      displayName: { type: String, trim: true, default: "", maxlength: 300 },
      profilePhotoUrl: { type: String, trim: true, default: "", maxlength: 2000 },
      anonymous: { type: Boolean, default: false },
    },
    rating: { type: Number, min: 1, max: 5, default: null, index: true },
    comment: { type: String, trim: true, default: "", maxlength: 20000 },
    sourceUrl: { type: String, trim: true, default: "", maxlength: 2000 },
    reviewReplyUrl: { type: String, trim: true, default: "", maxlength: 2000 },
    providerCreatedAt: { type: Date, default: null, index: true },
    providerUpdatedAt: { type: Date, default: null },
    providerReply: {
      comment: { type: String, trim: true, default: "", maxlength: 4096 },
      state: { type: String, trim: true, lowercase: true, default: "", maxlength: 80 },
      updatedAt: { type: Date, default: null },
    },
    linkedCustomer: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    linkedProfile: { type: Schema.Types.ObjectId, ref: "CustomerExperienceProfile", default: null, index: true },
    status: { type: String, enum: ["active", "deleted"], default: "active", index: true },
    provenance: {
      providerSchemaVersion: { type: String, trim: true, default: "1.0.0", maxlength: 40 },
      rawHash: { type: String, trim: true, lowercase: true, required: true, maxlength: 64 },
      syncedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

schema.index({ business: 1, provider: 1, externalId: 1 }, { unique: true });
schema.index({ business: 1, provider: 1, listingExternalId: 1, providerCreatedAt: -1 });

export default mongoose.models.ExternalReputationItem ||
  mongoose.model("ExternalReputationItem", schema);
