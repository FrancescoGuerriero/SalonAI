import mongoose from "mongoose";

import {
  STORED_VALUE_EVENT_TYPES,
  STORED_VALUE_UNITS,
} from "../platform/finance/storedValueLedger.js";

const { Schema } = mongoose;

const storedValueLedgerEntrySchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    program: { type: Schema.Types.ObjectId, ref: "StoredValueProgram", required: true, index: true },
    instrument: { type: Schema.Types.ObjectId, ref: "StoredValueInstrument", required: true, index: true },
    eventType: { type: String, enum: STORED_VALUE_EVENT_TYPES, required: true, index: true },
    unit: { type: String, enum: STORED_VALUE_UNITS, required: true },
    delta: { type: Number, required: true },
    currency: { type: String, trim: true, uppercase: true, default: "", maxlength: 3 },
    saleLocation: { type: Schema.Types.ObjectId, ref: "Location", default: null, index: true },
    redemptionLocation: { type: Schema.Types.ObjectId, ref: "Location", default: null, index: true },
    liabilityOwnerType: {
      type: String,
      enum: ["business", "location", "configured-entity"],
      default: "business",
    },
    liabilityOwnerLocation: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    sourceType: { type: String, trim: true, default: "", maxlength: 80 },
    sourceId: { type: String, trim: true, default: "", maxlength: 255 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 255 },
    occurredAt: { type: Date, required: true, index: true },
    actor: { type: String, trim: true, default: "system", maxlength: 120 },
    reversalOf: { type: Schema.Types.ObjectId, ref: "StoredValueLedgerEntry", default: null },
    ledgerFingerprint: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Ledger fingerprint must be a SHA-256 hex digest."],
    },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

storedValueLedgerEntrySchema.index({ business: 1, idempotencyKey: 1 }, { unique: true });
storedValueLedgerEntrySchema.index({ business: 1, instrument: 1, occurredAt: 1 });

storedValueLedgerEntrySchema.pre("save", function blockLedgerMutation() {
  if (!this.isNew) {
    const error = new Error(
      "Stored-value ledger entries are immutable; post a compensating or reversal entry instead."
    );
    error.code = "STORED_VALUE_LEDGER_IMMUTABLE";
    throw error;
  }
});

for (const operation of [
  "updateOne", "updateMany", "findOneAndUpdate", "replaceOne",
  "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete",
]) {
  storedValueLedgerEntrySchema.pre(operation, function blockLedgerQueryMutation() {
    const error = new Error(
      "Stored-value ledger entries are immutable; post a compensating or reversal entry instead."
    );
    error.code = "STORED_VALUE_LEDGER_IMMUTABLE";
    throw error;
  });
}

const StoredValueLedgerEntry =
  mongoose.models.StoredValueLedgerEntry || mongoose.model("StoredValueLedgerEntry", storedValueLedgerEntrySchema);

export default StoredValueLedgerEntry;
