import mongoose from "mongoose";

const { Schema } = mongoose;

const lotUsageSchema = new Schema(
  {
    inventoryItem: {
      type: Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    skuSnapshot: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 120,
    },
    itemNameSnapshot: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    lotNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    expiryAt: {
      type: Date,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
  },
  { _id: true }
);

const treatmentRecordSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    clinicalProfile: { type: Schema.Types.ObjectId, ref: "ClinicalProfile", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment", default: null, index: true },
    providerUser: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerCredential: { type: Schema.Types.ObjectId, ref: "ProviderCredential", default: null },
    treatmentConsent: { type: Schema.Types.ObjectId, ref: "ClinicalConsentRecord", required: true },
    procedureKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, index: true },
    procedureLabel: { type: String, required: true, trim: true, maxlength: 200 },
    performedAt: { type: Date, required: true, default: Date.now, index: true },
    clinicianAssessment: { type: String, trim: true, default: "", maxlength: 12000 },
    treatmentPerformed: { type: String, trim: true, default: "", maxlength: 12000 },
    aftercareInstructions: { type: String, trim: true, default: "", maxlength: 8000 },
    lotUsage: { type: [lotUsageSchema], default: [] },
    status: { type: String, enum: ["draft", "signed"], default: "draft", index: true },
    signedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    signedAt: { type: Date, default: null, index: true },
    signedSnapshotFingerprint: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      match: [/^$|^[a-f0-9]{64}$/, "Signed treatment snapshot fingerprint is invalid."],
    },
    aiDraftUsed: { type: Boolean, default: false },
    aiDraftInferenceId: { type: String, trim: true, default: "", maxlength: 160 },
    clinicianAttestation: { type: String, trim: true, default: "", maxlength: 1500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

treatmentRecordSchema.pre("validate", function validateClinicalSignatureEvidence() {
  if (this.aiDraftUsed === true && !String(this.aiDraftInferenceId || "").trim()) {
    const error = new Error(
      "Clinical records that used AI draft assistance require the inference identifier for provenance."
    );
    error.code = "CLINICAL_AI_DRAFT_PROVENANCE_REQUIRED";
    throw error;
  }
  if (this.status === "signed") {
    if (
      !this.providerCredential ||
      !this.signedBy ||
      !this.signedAt ||
      !String(this.clinicianAttestation || "").trim() ||
      !/^[a-f0-9]{64}$/.test(String(this.signedSnapshotFingerprint || ""))
    ) {
      const error = new Error(
        "Signed treatment records require verified provider credential, signer, attestation and snapshot fingerprint."
      );
      error.code = "CLINICAL_SIGNATURE_EVIDENCE_REQUIRED";
      throw error;
    }
  }
});

treatmentRecordSchema.pre("save", function blockSignedRecordMutation() {
  if (
    !this.isNew &&
    this.status === "signed" &&
    !this.isModified("status") &&
    this.modifiedPaths().length > 0
  ) {
    const error = new Error(
      "Signed clinical treatment records are immutable; use a separately audited addendum workflow."
    );
    error.code = "SIGNED_TREATMENT_RECORD_IMMUTABLE";
    throw error;
  }
});

treatmentRecordSchema.index({ business: 1, clinicalProfile: 1, performedAt: -1 });
treatmentRecordSchema.index({ business: 1, location: 1, status: 1, performedAt: -1 });

export default (
  mongoose.models.TreatmentRecord ||
  mongoose.model("TreatmentRecord", treatmentRecordSchema)
);
