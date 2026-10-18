import mongoose from "mongoose";

const { Schema } = mongoose;

const interLocationSettlementEventSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    fromLocation: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    toLocation: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 3 },
    reason: { type: String, trim: true, required: true, maxlength: 255 },
    sourceLedgerEntry: {
      type: Schema.Types.ObjectId,
      ref: "StoredValueLedgerEntry",
      required: true,
      index: true,
    },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 255 },
    settlementFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Settlement fingerprint must be a SHA-256 hex digest."],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "settled", "reversed"],
      default: "pending",
      index: true,
    },
    accountingExportReference: { type: String, trim: true, default: "", maxlength: 255 },
    approvedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    reversalOf: { type: Schema.Types.ObjectId, ref: "InterLocationSettlementEvent", default: null },
    actorUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

interLocationSettlementEventSchema.index({ business: 1, idempotencyKey: 1 }, { unique: true });
interLocationSettlementEventSchema.index({ business: 1, status: 1, createdAt: -1 });

const InterLocationSettlementEvent =
  mongoose.models.InterLocationSettlementEvent ||
  mongoose.model("InterLocationSettlementEvent", interLocationSettlementEventSchema);

export default InterLocationSettlementEvent;
