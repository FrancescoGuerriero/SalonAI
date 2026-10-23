import mongoose from "mongoose";

const { Schema } = mongoose;

const prescriptionReferenceSchema = new Schema(
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
    treatmentRecord: {
      type: Schema.Types.ObjectId,
      ref: "TreatmentRecord",
      default: null,
      index: true,
    },
    providerCredential: {
      type: Schema.Types.ObjectId,
      ref: "ProviderCredential",
      required: true,
    },
    connectorKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    externalReferenceHash: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-f0-9]{64}$/, "Prescription reference hash must be SHA-256."],
      index: true,
    },
    externalStatus: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled", "expired"],
      default: "active",
      index: true,
    },
    issuedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

prescriptionReferenceSchema.index(
  { business: 1, connectorKey: 1, externalReferenceHash: 1 },
  { unique: true }
);

export default (
  mongoose.models.PrescriptionReference ||
  mongoose.model("PrescriptionReference", prescriptionReferenceSchema)
);
