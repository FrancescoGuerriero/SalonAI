import mongoose from "mongoose";

const stripeWebhookEventSchema =
  new mongoose.Schema(
    {
      eventId: {
        type: String,
        required: true,
        trim: true,
        unique: true,
      },

      eventType: {
        type: String,
        required: true,
        trim: true,
      },

      objectId: {
        type: String,
        trim: true,
        default: "",
      },

      livemode: {
        type: Boolean,
        default: false,
      },

      status: {
        type: String,
        enum: [
          "processing",
          "processed",
          "failed",
        ],
        default: "processing",
        index: true,
      },

      claimId: {
        type: String,
        required: true,
        trim: true,
      },

      attempts: {
        type: Number,
        default: 1,
        min: 1,
      },

      processingStartedAt: {
        type: Date,
        required: true,
      },

      lockExpiresAt: {
        type: Date,
        required: true,
        index: true,
      },

      processedAt: {
        type: Date,
        default: null,
      },

      failedAt: {
        type: Date,
        default: null,
      },

      lastError: {
        type: String,
        trim: true,
        default: "",
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

stripeWebhookEventSchema.index(
  {
    status: 1,
    lockExpiresAt: 1,
  }
);

stripeWebhookEventSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

const StripeWebhookEvent =
  mongoose.models.StripeWebhookEvent ||
  mongoose.model(
    "StripeWebhookEvent",
    stripeWebhookEventSchema
  );

export default StripeWebhookEvent;