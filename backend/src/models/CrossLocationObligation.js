import mongoose from "mongoose";

const { Schema } = mongoose;

export const CROSS_LOCATION_OBLIGATION_STATUSES = Object.freeze([
  "open",
  "pending_review",
  "batched",
  "rejected",
  "reversed",
]);

const crossLocationObligationSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    program: {
      type: Schema.Types.ObjectId,
      ref: "StoredValueProgram",
      required: true,
      index: true,
    },
    sourceLedgerEntry: {
      type: Schema.Types.ObjectId,
      ref: "StoredValueLedgerEntry",
      required: true,
      index: true,
    },
    sourceLedgerFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Source ledger fingerprint must be a SHA-256 hex digest."],
    },
    sourceOccurredAt: {
      type: Date,
      required: true,
      index: true,
    },
    fromLocation: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    toLocation: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    settlementPolicy: {
      type: String,
      enum: ["receivable-payable", "manual-review"],
      required: true,
    },
    payable: {
      location: { type: Schema.Types.ObjectId, ref: "Location", required: true },
      amount: { type: Number, required: true, min: 0.01 },
    },
    receivable: {
      location: { type: Schema.Types.ObjectId, ref: "Location", required: true },
      amount: { type: Number, required: true, min: 0.01 },
    },
    status: {
      type: String,
      enum: CROSS_LOCATION_OBLIGATION_STATUSES,
      default: "open",
      index: true,
    },
    settlementBatch: {
      type: Schema.Types.ObjectId,
      ref: "SettlementBatch",
      default: null,
      index: true,
    },
    settlementFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Settlement fingerprint must be a SHA-256 hex digest."],
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

crossLocationObligationSchema.index(
  { business: 1, sourceLedgerEntry: 1 },
  { unique: true }
);
crossLocationObligationSchema.index({
  business: 1,
  status: 1,
  currency: 1,
  sourceOccurredAt: 1,
});

export default (
  mongoose.models.CrossLocationObligation ||
  mongoose.model("CrossLocationObligation", crossLocationObligationSchema)
);
