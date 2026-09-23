import mongoose from "mongoose";

const consentRecordSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    customerProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    purpose: {
      type: String,
      enum: [
        "email_marketing",
        "sms_marketing",
        "whatsapp_marketing",
        "push_marketing",
        "analytics",
      ],
      required: true,
      index: true,
    },
    granted: {
      type: Boolean,
      required: true,
    },
    source: {
      type: String,
      default: "customer_portal",
    },
    channel: {
      type: String,
      enum: ["email", "sms", "whatsapp", "push", ""],
      default: "",
    },
    policyVersion: String,
    ipAddress: {
      type: String,
      trim: true,
      default: "",
      maxlength: 128,
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
      maxlength: 512,
    },
    requestId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 128,
    },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default (
  mongoose.models.ConsentRecord ||
  mongoose.model("ConsentRecord", consentRecordSchema)
);
