import mongoose from "mongoose";

import { STORED_VALUE_UNITS } from "../platform/finance/storedValueLedger.js";

const { Schema } = mongoose;

const storedValueInstrumentSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    program: { type: Schema.Types.ObjectId, ref: "StoredValueProgram", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    originLocation: { type: Schema.Types.ObjectId, ref: "Location", default: null, index: true },
    externalReferenceHash: { type: String, trim: true, lowercase: true, default: "", maxlength: 128 },
    status: {
      type: String,
      enum: ["active", "frozen", "exhausted", "expired", "closed"],
      default: "active",
      index: true,
    },
    unit: { type: String, enum: STORED_VALUE_UNITS, required: true, default: "money" },
    currency: { type: String, trim: true, uppercase: true, default: "GBP", minlength: 3, maxlength: 3 },
    cachedBalance: { type: Number, default: 0 },
    cacheRevision: { type: Number, min: 0, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

storedValueInstrumentSchema.index({ business: 1, program: 1, status: 1 });
storedValueInstrumentSchema.index(
  { business: 1, externalReferenceHash: 1 },
  {
    unique: true,
    partialFilterExpression: { externalReferenceHash: { $type: "string", $gt: "" } },
  }
);

const StoredValueInstrument =
  mongoose.models.StoredValueInstrument || mongoose.model("StoredValueInstrument", storedValueInstrumentSchema);

export default StoredValueInstrument;
