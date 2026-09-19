import mongoose from "mongoose";

const PROCESSING_STATUSES = [
  "pending",
  "processed",
  "ignored",
  "failed",
];

const CHANNELS = [
  "sms",
  "whatsapp",
  "unknown",
];

const twilioStatusWebhookEventSchema =
  new mongoose.Schema(
    {
      eventKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        maxlength: 64,
      },

      providerMessageId: {
        type: String,
        required: true,
        trim: true,
        index: true,
        maxlength: 100,
      },

      providerStatus: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 50,
      },

      channel: {
        type: String,
        enum: CHANNELS,
        default: "unknown",
        index: true,
      },

      processingStatus: {
        type: String,
        enum: PROCESSING_STATUSES,
        default: "pending",
        index: true,
      },

      processingReason: {
        type: String,
        trim: true,
        default: "",
        maxlength: 200,
      },

      delivery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MessageDelivery",
        default: null,
        index: true,
      },

      deliveryId: {
        type: String,
        trim: true,
        default: "",
        maxlength: 200,
      },

      whatsappConversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WhatsAppConversation",
        default: null,
        index: true,
      },

      attemptCount: {
        type: Number,
        min: 0,
        default: 0,
      },

      evidence: {
        errorCode: {
          type: String,
          trim: true,
          default: "",
          maxlength: 100,
        },

        errorMessage: {
          type: String,
          trim: true,
          default: "",
          maxlength: 1000,
        },

        price: {
          type: String,
          trim: true,
          default: "",
          maxlength: 100,
        },

        priceUnit: {
          type: String,
          trim: true,
          default: "",
          maxlength: 20,
        },

        numSegments: {
          type: Number,
          min: 0,
          default: null,
        },

        apiVersion: {
          type: String,
          trim: true,
          default: "",
          maxlength: 50,
        },
      },

      receivedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },

      processedAt: {
        type: Date,
        default: null,
      },

      lastError: {
        code: {
          type: String,
          trim: true,
          default: "",
          maxlength: 200,
        },

        message: {
          type: String,
          trim: true,
          default: "",
          maxlength: 1000,
        },
      },
    },
    {
      timestamps: true,
    }
  );

twilioStatusWebhookEventSchema.index({
  providerMessageId: 1,
  processingStatus: 1,
  receivedAt: 1,
});

const TwilioStatusWebhookEvent =
  mongoose.models
    .TwilioStatusWebhookEvent ||
  mongoose.model(
    "TwilioStatusWebhookEvent",
    twilioStatusWebhookEventSchema
  );

export {
  CHANNELS as TWILIO_STATUS_CHANNELS,
  PROCESSING_STATUSES as TWILIO_STATUS_PROCESSING_STATUSES,
};

export default TwilioStatusWebhookEvent;
