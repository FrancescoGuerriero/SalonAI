import mongoose from "mongoose";

const { Schema } = mongoose;

const webhookDeliverySchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    app: { type: Schema.Types.ObjectId, ref: "IntegrationApp", required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "WebhookSubscription", required: true, index: true },
    eventId: { type: String, required: true, trim: true, maxlength: 100, index: true },
    eventType: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
    eventVersion: { type: String, required: true, trim: true, default: "1", maxlength: 32 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 255 },
    status: {
      type: String,
      enum: ["pending", "delivering", "retry_scheduled", "succeeded", "dead_letter"],
      default: "pending",
      index: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    occurredAt: { type: Date, required: true, index: true },
    attemptCount: { type: Number, min: 0, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastAttemptAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    responseStatus: { type: Number, default: null },
    responseBodySnippet: { type: String, trim: true, default: "", maxlength: 2000 },
    lastError: { type: String, trim: true, default: "", maxlength: 2000 },
    replayOf: { type: Schema.Types.ObjectId, ref: "WebhookDelivery", default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

webhookDeliverySchema.index({ business: 1, subscription: 1, idempotencyKey: 1 }, { unique: true });
webhookDeliverySchema.index({ status: 1, nextAttemptAt: 1, _id: 1 });

export default (
  mongoose.models.WebhookDelivery ||
  mongoose.model("WebhookDelivery", webhookDeliverySchema)
);
