import mongoose from "mongoose";

const { Schema } = mongoose;

const integrationAppSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    ownerUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      default: "development",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "suspended", "revoked"],
      default: "draft",
      index: true,
    },
    scopes: {
      type: [String],
      default: [],
      set(value) {
        return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean))];
      },
    },
    redirectUris: {
      type: [String],
      default: [],
    },
    allowedOrigins: {
      type: [String],
      default: [],
    },
    ratePolicy: {
      version: { type: String, trim: true, default: "1.0.0", maxlength: 40 },
      requests: { type: Number, min: 1, max: 1000000, default: 600 },
      windowSeconds: { type: Number, min: 1, max: 86400, default: 60 },
    },
    lastUsedAt: {
      type: Date,
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

integrationAppSchema.index({ business: 1, key: 1 }, { unique: true });
integrationAppSchema.index({ business: 1, status: 1, environment: 1 });

export default (
  mongoose.models.IntegrationApp ||
  mongoose.model("IntegrationApp", integrationAppSchema)
);
