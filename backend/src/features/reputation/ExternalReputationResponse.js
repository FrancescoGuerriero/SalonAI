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
    externalReview: {
      type: Schema.Types.ObjectId,
      ref: "ExternalReview",
      required: true,
      unique: true,
      index: true,
    },
    responseText: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    responseStatus: {
      type: String,
      enum: ["none", "draft", "approved", "published", "withdrawn"],
      default: "none",
      index: true,
    },
    moderationNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    providerResponseId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastError: {
      code: { type: String, trim: true, default: "", maxlength: 200 },
      message: { type: String, trim: true, default: "", maxlength: 2000 },
      at: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

schema.index({ business: 1, responseStatus: 1, updatedAt: -1 });

export default mongoose.models.ExternalReputationResponse ||
  mongoose.model("ExternalReputationResponse", schema);
