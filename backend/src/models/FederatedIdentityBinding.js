import mongoose from "mongoose";

const { Schema } = mongoose;

const federatedIdentityBindingSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    provider: {
      type: Schema.Types.ObjectId,
      ref: "EnterpriseIdentityProvider",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    protocol: {
      type: String,
      enum: ["oidc", "saml"],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    emailAtLink: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 320,
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },
    linkedAt: { type: Date, default: Date.now },
    lastAuthenticatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

federatedIdentityBindingSchema.index(
  { provider: 1, subject: 1 },
  { unique: true }
);
federatedIdentityBindingSchema.index(
  { business: 1, provider: 1, user: 1 },
  { unique: true }
);
federatedIdentityBindingSchema.index({ business: 1, user: 1, status: 1 });

export default (
  mongoose.models.FederatedIdentityBinding ||
  mongoose.model("FederatedIdentityBinding", federatedIdentityBindingSchema)
);
