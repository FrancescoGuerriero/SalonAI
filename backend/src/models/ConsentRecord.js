import mongoose from "mongoose";

const consentRecordSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    policyVersion: String,
    ipAddress: String,
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
