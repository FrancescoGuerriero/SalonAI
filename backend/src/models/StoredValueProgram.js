import mongoose from "mongoose";

import {
  CROSS_LOCATION_REDEMPTION_POLICIES,
  LIABILITY_POLICIES,
  SETTLEMENT_POLICIES,
  STORED_VALUE_PROGRAM_TYPES,
  STORED_VALUE_UNITS,
} from "../platform/finance/storedValueLedger.js";

const { Schema } = mongoose;

const storedValueProgramSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    programType: { type: String, enum: STORED_VALUE_PROGRAM_TYPES, required: true, index: true },
    unit: { type: String, enum: STORED_VALUE_UNITS, required: true, default: "money" },
    currency: { type: String, trim: true, uppercase: true, default: "GBP", minlength: 3, maxlength: 3 },
    liabilityPolicy: { type: String, enum: LIABILITY_POLICIES, required: true, default: "business-central" },
    crossLocationRedemptionPolicy: {
      type: String,
      enum: CROSS_LOCATION_REDEMPTION_POLICIES,
      required: true,
      default: "same-location",
    },
    settlementPolicy: { type: String, enum: SETTLEMENT_POLICIES, required: true, default: "none" },
    allowedLocations: {
      type: [{ type: Schema.Types.ObjectId, ref: "Location" }],
      default: [],
    },
    status: { type: String, enum: ["draft", "active", "retired"], default: "draft", index: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

storedValueProgramSchema.index({ business: 1, key: 1 }, { unique: true });

const StoredValueProgram =
  mongoose.models.StoredValueProgram || mongoose.model("StoredValueProgram", storedValueProgramSchema);

export default StoredValueProgram;
