import mongoose from "mongoose";

const { Schema } = mongoose;

const eventSelectorSchema = new Schema(
  {
    type: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    version: { type: String, required: true, trim: true, default: "1", maxlength: 32 },
  },
  { _id: false }
);

const webhookSubscriptionSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    app: { type: Schema.Types.ObjectId, ref: "IntegrationApp", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    endpointUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    status: {
      type: String,
      enum: ["active", "paused", "disabled"],
      default: "active",
      index: true,
    },
    events: { type: [eventSelectorSchema], default: [] },
    signingCredential: {
      type: Schema.Types.ObjectId,
      ref: "CredentialVersion",
      required: true,
    },
    retryPolicy: {
      maxAttempts: { type: Number, min: 1, max: 20, default: 8 },
      baseDelaySeconds: { type: Number, min: 1, max: 3600, default: 30 },
      maxDelaySeconds: { type: Number, min: 1, max: 86400, default: 3600 },
    },
    lastDeliveredAt: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: "", maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

webhookSubscriptionSchema.pre("validate", function validateEndpoint() {
  try {
    const url = new URL(this.endpointUrl);
    if (!["https:", "http:"].includes(url.protocol)) {
      this.invalidate("endpointUrl", "Webhook endpoint must use HTTP or HTTPS.");
    }
    if (
      this.status === "active" &&
      this.endpointUrl &&
      process.env.NODE_ENV === "production" &&
      url.protocol !== "https:"
    ) {
      this.invalidate("endpointUrl", "Production webhook endpoints must use HTTPS.");
    }
  } catch {
    this.invalidate("endpointUrl", "Webhook endpoint must be a valid URL.");
  }
});

webhookSubscriptionSchema.index({ business: 1, app: 1, status: 1 });
webhookSubscriptionSchema.index({ business: 1, "events.type": 1, status: 1 });

export default (
  mongoose.models.WebhookSubscription ||
  mongoose.model("WebhookSubscription", webhookSubscriptionSchema)
);
