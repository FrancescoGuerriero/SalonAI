import mongoose from "mongoose";

const { Schema } = mongoose;

export const SETTLEMENT_BATCH_STATUSES = Object.freeze([
  "draft",
  "review_ready",
  "void",
]);

const settlementBatchSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      index: true,
    },
    status: {
      type: String,
      enum: SETTLEMENT_BATCH_STATUSES,
      default: "draft",
      index: true,
    },
    obligations: {
      type: [{ type: Schema.Types.ObjectId, ref: "CrossLocationObligation" }],
      default: [],
    },
    obligationCount: {
      type: Number,
      min: 1,
      required: true,
    },
    totalAmount: {
      type: Number,
      min: 0.01,
      required: true,
    },
    period: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    settlementFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Batch fingerprint must be a SHA-256 hex digest."],
      index: true,
    },
    paymentExecutionAllowed: {
      type: Boolean,
      default: false,
      validate: {
        validator(value) {
          return value === false;
        },
        message: "Settlement batches are reconciliation evidence only; payment execution is disabled.",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1500,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

settlementBatchSchema.index({ business: 1, status: 1, createdAt: -1 });
settlementBatchSchema.index(
  { business: 1, settlementFingerprint: 1 },
  { unique: true }
);

export default (
  mongoose.models.SettlementBatch ||
  mongoose.model("SettlementBatch", settlementBatchSchema)
);
