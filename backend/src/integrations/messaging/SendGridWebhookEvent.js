import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

const sendGridWebhookEventSchema =
  new Schema(
    {
      eventId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 200,
      },
      eventType: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true,
      },
      sendGridMessageId: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      smtpId: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      occurredAt: {
        type: Date,
        default: null,
        index: true,
      },
      delivery: {
        type: Schema.Types.ObjectId,
        ref: "MessageDelivery",
        default: null,
        index: true,
      },
      deliveryId: {
        type: String,
        trim: true,
        default: "",
        index: true,
      },
      processingStatus: {
        type: String,
        enum: [
          "pending",
          "processed",
          "ignored",
          "failed",
        ],
        default: "pending",
        index: true,
      },
      processingReason: {
        type: String,
        trim: true,
        default: "",
        maxlength: 500,
      },
      attemptCount: {
        type: Number,
        min: 0,
        default: 0,
      },
      evidence: {
        response: {
          type: String,
          trim: true,
          default: "",
          maxlength: 2000,
        },
        reason: {
          type: String,
          trim: true,
          default: "",
          maxlength: 2000,
        },
        status: {
          type: String,
          trim: true,
          default: "",
          maxlength: 100,
        },
        attempt: {
          type: Number,
          min: 0,
          default: null,
        },
        asmGroupId: {
          type: Number,
          default: null,
        },
        machineOpen: {
          type: Boolean,
          default: null,
        },
        marketingCampaignId: {
          type: String,
          trim: true,
          default: "",
          maxlength: 200,
        },
      },
      lastError: {
        code: {
          type: String,
          trim: true,
          default: "",
        },
        message: {
          type: String,
          trim: true,
          default: "",
          maxlength: 2000,
        },
      },
      processedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

sendGridWebhookEventSchema.index({
  processingStatus: 1,
  createdAt: 1,
});

const SendGridWebhookEvent =
  mongoose.models
    .SendGridWebhookEvent ||
  mongoose.model(
    "SendGridWebhookEvent",
    sendGridWebhookEventSchema
  );

export default SendGridWebhookEvent;
