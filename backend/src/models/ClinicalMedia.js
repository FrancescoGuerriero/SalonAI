import mongoose from "mongoose";

const { Schema } = mongoose;

const clinicalMediaSchema = new Schema(
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
      enum: ["clinical_documentation", "treatment_progress", "pre_treatment", "post_treatment"],
      required: true,
      index: true,
    },
    storageProvider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      select: false,
    },
    contentSha256: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Clinical media SHA-256 digest is invalid."],
      index: true,
    },
    contentType: {
      type: String,
      required: true,
      enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    },
    byteSize: {
      type: Number,
      required: true,
      min: 1,
      max: 50 * 1024 * 1024,
    },
    clinicalConsent: {
      type: Schema.Types.ObjectId,
      ref: "ClinicalConsentRecord",
      required: true,
    },
    marketingConsent: {
      type: Schema.Types.ObjectId,
      ref: "ClinicalConsentRecord",
      default: null,
    },
    marketingUseAllowed: {
      type: Boolean,
      default: false,
    },
    retentionDeleteAfter: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "retention_due", "disposed"],
      default: "active",
      index: true,
    },
    disposedAt: {
      type: Date,
      default: null,
    },
    disposedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    capturedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

clinicalMediaSchema.pre("validate", function validateClinicalMediaConsent() {
  if (this.marketingUseAllowed === true && !this.marketingConsent) {
    const error = new Error(
      "Clinical media cannot be authorised for marketing without separate marketing-photography consent evidence."
    );
    error.code = "CLINICAL_MEDIA_MARKETING_CONSENT_REQUIRED";
    throw error;
  }
  if (this.status === "disposed" && (!this.disposedAt || !this.disposedBy)) {
    const error = new Error("Disposed clinical media requires disposal actor and timestamp.");
    error.code = "CLINICAL_MEDIA_DISPOSAL_EVIDENCE_REQUIRED";
    throw error;
  }
});

clinicalMediaSchema.index({
  business: 1,
  clinicalProfile: 1,
  status: 1,
  capturedAt: -1,
});
clinicalMediaSchema.index({
  business: 1,
  contentSha256: 1,
  clinicalProfile: 1,
});

export default (
  mongoose.models.ClinicalMedia ||
  mongoose.model("ClinicalMedia", clinicalMediaSchema)
);
