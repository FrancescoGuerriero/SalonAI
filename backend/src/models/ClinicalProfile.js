import mongoose from "mongoose";

const { Schema } = mongoose;

const clinicalProfileSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    homeLocation: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },
    dataClassification: {
      type: String,
      enum: ["restricted-clinical"],
      default: "restricted-clinical",
      required: true,
    },
    primaryProvider: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    externalPatientReferenceHash: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      match: [/^$|^[a-f0-9]{64}$/, "External patient reference hash must be SHA-256."],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
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

clinicalProfileSchema.index({ business: 1, customer: 1 }, { unique: true });
clinicalProfileSchema.index({ business: 1, homeLocation: 1, status: 1 });

export default (
  mongoose.models.ClinicalProfile ||
  mongoose.model("ClinicalProfile", clinicalProfileSchema)
);
