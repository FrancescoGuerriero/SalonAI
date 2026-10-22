import mongoose from "mongoose";

const { Schema } = mongoose;

const connectorHealthSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    app: { type: Schema.Types.ObjectId, ref: "IntegrationApp", required: true, index: true },
    connection: { type: Schema.Types.ObjectId, ref: "IntegrationConnection", default: null, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "WebhookSubscription", default: null, index: true },
    componentKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    status: {
      type: String,
      enum: ["healthy", "degraded", "error", "disconnected", "unknown"],
      default: "unknown",
      index: true,
    },
    lastSuccessAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: "", maxlength: 2000 },
    latencyMs: { type: Number, min: 0, default: null },
    retryAt: { type: Date, default: null, index: true },
    tokenExpiresAt: { type: Date, default: null, index: true },
    metrics: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

connectorHealthSchema.index(
  { business: 1, app: 1, componentKey: 1 },
  { unique: true }
);

export default (
  mongoose.models.ConnectorHealth ||
  mongoose.model("ConnectorHealth", connectorHealthSchema)
);
