import mongoose from "mongoose";

const { Schema } = mongoose;

const credentialVersionSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    app: { type: Schema.Types.ObjectId, ref: "IntegrationApp", required: true, index: true },
    credentialType: {
      type: String,
      enum: [
        "api_key",
        "service_key",
        "webhook_signing",
        "oauth_client_secret",
        "oauth_access_token",
        "oauth_refresh_token",
        "provider_api_key",
      ],
      required: true,
      index: true,
    },
    version: { type: Number, min: 1, required: true },
    keyPrefix: { type: String, trim: true, lowercase: true, default: "", maxlength: 64, index: true },
    secretHash: { type: String, required: true, trim: true, lowercase: true, select: false, maxlength: 128 },
    secretCiphertext: { type: String, required: true, select: false },
    secretIv: { type: String, required: true, select: false, maxlength: 64 },
    secretTag: { type: String, required: true, select: false, maxlength: 64 },
    status: {
      type: String,
      enum: ["active", "retiring", "revoked", "expired"],
      default: "active",
      index: true,
    },
    validFrom: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null, index: true },
    retireAfter: { type: Date, default: null, index: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

credentialVersionSchema.index({ business: 1, app: 1, credentialType: 1, version: 1 }, { unique: true });
credentialVersionSchema.index(
  { business: 1, keyPrefix: 1 },
  {
    unique: true,
    partialFilterExpression: { keyPrefix: { $type: "string", $gt: "" } },
  }
);
credentialVersionSchema.index({
  business: 1,
  app: 1,
  "metadata.connectionId": 1,
  "metadata.bindingRole": 1,
  status: 1,
});

export default (
  mongoose.models.CredentialVersion ||
  mongoose.model("CredentialVersion", credentialVersionSchema)
);
