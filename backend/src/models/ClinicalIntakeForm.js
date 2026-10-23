import mongoose from "mongoose";

const { Schema } = mongoose;

const clinicalIntakeFormSchema = new Schema(
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
    formKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },
    formVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    responses: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "reviewed", "superseded"],
      default: "draft",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
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
  },
  { timestamps: true, optimisticConcurrency: true }
);

clinicalIntakeFormSchema.index({
  business: 1,
  clinicalProfile: 1,
  formKey: 1,
  createdAt: -1,
});

export default (
  mongoose.models.ClinicalIntakeForm ||
  mongoose.model("ClinicalIntakeForm", clinicalIntakeFormSchema)
);
