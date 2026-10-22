import mongoose from "mongoose";

const { Schema } = mongoose;

const collectionAttemptSchema = new Schema(
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
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    attemptedAt: {
      type: Date,
      default: null,
    },
    amount: {
      type: Number,
      min: 0,
      required: true,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "GBP",
      minlength: 3,
      maxlength: 3,
    },
    attemptNumber: {
      type: Number,
      min: 1,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "Collection attempt number must be an integer.",
      },
    },
    status: {
      type: String,
      enum: ["planned", "processing", "succeeded", "failed", "abandoned"],
      default: "planned",
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 80,
    },
    providerReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 240,
    },
    failureCode: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
  },
  {
    timestamps: true,
  }
);

collectionAttemptSchema.index(
  { business: 1, idempotencyKey: 1 },
  { unique: true }
);

export default (
  mongoose.models.CollectionAttempt ||
  mongoose.model("CollectionAttempt", collectionAttemptSchema)
);
