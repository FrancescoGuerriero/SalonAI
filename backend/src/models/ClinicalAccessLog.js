import mongoose from "mongoose";

const { Schema } = mongoose;

const clinicalAccessLogSchema = new Schema(
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
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["read", "create", "update", "submit", "review", "sign", "dispose", "consent_record", "credential_verify"],
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    resourceId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },
    clinicalProfile: {
      type: Schema.Types.ObjectId,
      ref: "ClinicalProfile",
      default: null,
      index: true,
    },
    purpose: {
      type: String,
      trim: true,
      default: "clinical-care",
      maxlength: 160,
    },
    requestId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
      index: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

clinicalAccessLogSchema.index({
  business: 1,
  clinicalProfile: 1,
  occurredAt: -1,
});
clinicalAccessLogSchema.index({
  business: 1,
  resourceType: 1,
  resourceId: 1,
  occurredAt: -1,
});

clinicalAccessLogSchema.pre("save", function blockClinicalAccessMutation() {
  if (!this.isNew) {
    const error = new Error("Clinical access logs are immutable.");
    error.code = "CLINICAL_ACCESS_LOG_IMMUTABLE";
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
  clinicalAccessLogSchema.pre(operation, function blockClinicalAccessQueryMutation() {
    const error = new Error("Clinical access logs are immutable.");
    error.code = "CLINICAL_ACCESS_LOG_IMMUTABLE";
    throw error;
  });
}

export default (
  mongoose.models.ClinicalAccessLog ||
  mongoose.model("ClinicalAccessLog", clinicalAccessLogSchema)
);
