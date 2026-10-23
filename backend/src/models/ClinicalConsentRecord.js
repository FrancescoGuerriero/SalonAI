import mongoose from "mongoose";

const { Schema } = mongoose;

export const CLINICAL_CONSENT_PURPOSES = Object.freeze([
  "clinical_treatment",
  "clinical_records",
  "clinical_photography",
  "marketing_photography",
  "telehealth",
]);

const clinicalConsentRecordSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    clinicalProfile: {
      type: Schema.Types.ObjectId,
      ref: "ClinicalProfile",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: CLINICAL_CONSENT_PURPOSES,
      required: true,
      index: true,
    },
    scopeKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 120,
      index: true,
    },
    granted: {
      type: Boolean,
      required: true,
    },
    policyVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    evidence: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    source: {
      type: String,
      trim: true,
      default: "staff-assisted",
      maxlength: 120,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recordedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
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
    supersedes: {
      type: Schema.Types.ObjectId,
      ref: "ClinicalConsentRecord",
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

clinicalConsentRecordSchema.index({
  business: 1,
  clinicalProfile: 1,
  purpose: 1,
  scopeKey: 1,
  recordedAt: -1,
});

clinicalConsentRecordSchema.pre("save", function blockConsentMutation() {
  if (!this.isNew) {
    const error = new Error(
      "Clinical consent evidence is append-only; create a new grant/revocation record instead."
    );
    error.code = "CLINICAL_CONSENT_IMMUTABLE";
    throw error;
  }
});

for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  clinicalConsentRecordSchema.pre(operation, function blockConsentQueryMutation() {
    const error = new Error(
      "Clinical consent evidence is append-only; create a new grant/revocation record instead."
    );
    error.code = "CLINICAL_CONSENT_IMMUTABLE";
    throw error;
  });
}

export default (
  mongoose.models.ClinicalConsentRecord ||
  mongoose.model("ClinicalConsentRecord", clinicalConsentRecordSchema)
);
