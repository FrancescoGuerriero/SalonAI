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
    membershipContract: {
      type: Schema.Types.ObjectId,
      ref: "MembershipContract",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    collectionAttempt: {
      type: Schema.Types.ObjectId,
      ref: "CollectionAttempt",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "recovered", "escalated", "closed"],
      default: "open",
      index: true,
    },
    failureCode: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    provider: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    providerReference: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    failedAt: {
      type: Date,
      required: true,
      index: true,
    },
    nextActionAt: {
      type: Date,
      default: null,
      index: true,
    },
    recoveredAt: {
      type: Date,
      default: null,
    },
    resolvedByCollectionAttempt: {
      type: Schema.Types.ObjectId,
      ref: "CollectionAttempt",
      default: null,
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

schema.index({ business: 1, status: 1, nextActionAt: 1 });
schema.index({ membershipContract: 1, status: 1, failedAt: -1 });

export default mongoose.models.MembershipRecoveryCase ||
  mongoose.model("MembershipRecoveryCase", schema);
