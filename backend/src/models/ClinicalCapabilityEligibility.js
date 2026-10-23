import mongoose from "mongoose";

const { Schema } = mongoose;

export const CLINICAL_ELIGIBILITY_STATUSES = Object.freeze([
  "eligible",
  "suspended",
  "revoked",
]);

const clinicalCapabilityEligibilitySchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    regionKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    status: {
      type: String,
      enum: CLINICAL_ELIGIBILITY_STATUSES,
      default: "suspended",
      index: true,
    },
    allowedLocations: {
      type: [{ type: Schema.Types.ObjectId, ref: "Location" }],
      default: [],
    },
    policyVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    jurisdictionReference: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      default: null,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

clinicalCapabilityEligibilitySchema.index(
  { business: 1, regionKey: 1 },
  { unique: true }
);

export default (
  mongoose.models.ClinicalCapabilityEligibility ||
  mongoose.model("ClinicalCapabilityEligibility", clinicalCapabilityEligibilitySchema)
);
