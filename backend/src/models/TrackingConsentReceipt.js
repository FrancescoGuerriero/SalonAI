import mongoose from "mongoose";

const trackingConsentReceiptSchema =
  new mongoose.Schema(
    {
      receiptId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        minlength: 12,
        maxlength: 128,
      },
      version: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },
      necessary: {
        type: Boolean,
        default: true,
      },
      choices: {
        analytics: {
          type: Boolean,
          required: true,
          default: false,
        },
        advertising: {
          type: Boolean,
          required: true,
          default: false,
        },
        experience: {
          type: Boolean,
          required: true,
          default: false,
        },
      },
      source: {
        type: String,
        trim: true,
        default: "consent_banner",
        maxlength: 80,
      },
      consentUpdatedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

trackingConsentReceiptSchema.index({
  consentUpdatedAt: -1,
});

export default (
  mongoose.models
    .TrackingConsentReceipt ||
  mongoose.model(
    "TrackingConsentReceipt",
    trackingConsentReceiptSchema
  )
);
