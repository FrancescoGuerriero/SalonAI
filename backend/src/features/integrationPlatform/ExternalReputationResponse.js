import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    review: { type: Schema.Types.ObjectId, ref: "ExternalReputationItem", required: true, unique: true, index: true },
    responseText: { type: String, trim: true, required: true, maxlength: 4096 },
    status: {
      type: String,
      enum: ["draft", "approved", "publishing", "published", "rejected", "failed"],
      default: "draft",
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
    providerState: { type: String, trim: true, lowercase: true, default: "", maxlength: 80 },
    providerReference: { type: String, trim: true, default: "", maxlength: 1000 },
    failureMessage: { type: String, trim: true, default: "", maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

schema.pre("validate", function enforceHumanApproval() {
  if (["approved", "publishing", "published"].includes(this.status)) {
    if (!this.approvedBy || !this.approvedAt) {
      const error = new Error("External review response publication requires explicit human approval.");
      error.code = "EXTERNAL_REVIEW_RESPONSE_APPROVAL_REQUIRED";
      throw error;
    }
  }
  if (this.status === "published" && (!this.publishedBy || !this.publishedAt)) {
    const error = new Error("Published external review responses require publication audit evidence.");
    error.code = "EXTERNAL_REVIEW_RESPONSE_PUBLICATION_EVIDENCE_REQUIRED";
    throw error;
  }
});

schema.index({ business: 1, status: 1, updatedAt: -1 });

export default mongoose.models.ExternalReputationResponse ||
  mongoose.model("ExternalReputationResponse", schema);
