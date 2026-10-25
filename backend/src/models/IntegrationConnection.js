import mongoose from "mongoose";

const { Schema } = mongoose;

const credentialBindingSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["access_token", "refresh_token", "client_secret", "api_key"],
      required: true,
    },
    credential: {
      type: Schema.Types.ObjectId,
      ref: "CredentialVersion",
      required: true,
    },
  },
  { _id: false }
);

const integrationConnectionSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    app: { type: Schema.Types.ObjectId, ref: "IntegrationApp", required: true, index: true },
    provider: { type: String, required: true, trim: true, lowercase: true, maxlength: 100, index: true },
    connectionKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    status: {
      type: String,
      enum: ["pending", "connected", "degraded", "disconnected", "revoked"],
      default: "pending",
      index: true,
    },
    scopes: { type: [String], default: [] },
    credentialBindings: { type: [credentialBindingSchema], default: [] },
    externalAccountReferenceHash: { type: String, trim: true, lowercase: true, default: "", maxlength: 128 },
    connectedAt: { type: Date, default: null },
    disconnectedAt: { type: Date, default: null },
    tokenExpiresAt: { type: Date, default: null, index: true },
    lastSyncAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

integrationConnectionSchema.index(
  { business: 1, app: 1, provider: 1, connectionKey: 1 },
  { unique: true }
);
integrationConnectionSchema.index({ business: 1, provider: 1, status: 1, lastSyncAt: 1 });

export default (
  mongoose.models.IntegrationConnection ||
  mongoose.model("IntegrationConnection", integrationConnectionSchema)
);
