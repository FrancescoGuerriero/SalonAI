import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    connection: {
      type: Schema.Types.ObjectId,
      ref: "IntegrationConnection",
      default: null,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },
    externalLocationReference: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    observedAt: {
      type: Date,
      required: true,
      index: true,
    },
    listing: {
      name: { type: String, trim: true, default: "", maxlength: 500 },
      address: { type: String, trim: true, default: "", maxlength: 1500 },
      phone: { type: String, trim: true, default: "", maxlength: 100 },
      websiteUrl: { type: String, trim: true, default: "", maxlength: 3000 },
      primaryCategory: { type: String, trim: true, default: "", maxlength: 300 },
      status: { type: String, trim: true, lowercase: true, default: "", maxlength: 100 },
    },
    providerPayloadDigest: {
      type: String,
      trim: true,
      default: "",
      maxlength: 128,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

schema.index({
  business: 1,
  location: 1,
  provider: 1,
  externalLocationReference: 1,
  observedAt: -1,
});
schema.index({ business: 1, location: 1, observedAt: -1 });

export default mongoose.models.BusinessListingSnapshot ||
  mongoose.model("BusinessListingSnapshot", schema);
