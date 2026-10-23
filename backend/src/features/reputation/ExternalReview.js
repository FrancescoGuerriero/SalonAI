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
      default: null,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
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
    externalReviewId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    externalLocationReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    reviewer: {
      displayName: { type: String, trim: true, default: "", maxlength: 300 },
      externalReferenceHash: { type: String, trim: true, default: "", maxlength: 128 },
    },
    linkage: {
      status: {
        type: String,
        enum: ["unlinked", "candidate", "verified", "rejected"],
        default: "unlinked",
        index: true,
      },
      method: {
        type: String,
        enum: ["none", "provider_verified", "manual"],
        default: "none",
      },
      linkedAt: { type: Date, default: null },
      linkedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      note: { type: String, trim: true, default: "", maxlength: 1000 },
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    body: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10000,
    },
    reviewedAt: {
      type: Date,
      required: true,
      index: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: ["active", "removed"],
      default: "active",
      index: true,
    },
    providerPayloadDigest: {
      type: String,
      trim: true,
      default: "",
      maxlength: 128,
    },
    importedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

schema.index(
  { business: 1, provider: 1, externalReviewId: 1 },
  { unique: true }
);
schema.index({ business: 1, status: 1, reviewedAt: -1 });
schema.index({ business: 1, location: 1, provider: 1, reviewedAt: -1 });
schema.index({ business: 1, customer: 1, reviewedAt: -1 });

export default mongoose.models.ExternalReview ||
  mongoose.model("ExternalReview", schema);
