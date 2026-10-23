import mongoose from "mongoose";

const { Schema } = mongoose;

export const ENTERPRISE_SSO_PROTOCOLS = Object.freeze(["oidc", "saml"]);
export const ENTERPRISE_SSO_STATUSES = Object.freeze([
  "draft",
  "validated",
  "suspended",
]);

const enterpriseSsoConnectionSchema = new Schema(
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
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    protocol: {
      type: String,
      enum: ENTERPRISE_SSO_PROTOCOLS,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ENTERPRISE_SSO_STATUSES,
      default: "draft",
      index: true,
    },
    domains: {
      type: [String],
      default: [],
    },
    oidc: {
      issuerUrl: { type: String, trim: true, default: "", maxlength: 1000 },
      clientId: { type: String, trim: true, default: "", maxlength: 500 },
      credentialVersion: {
        type: Schema.Types.ObjectId,
        ref: "CredentialVersion",
        default: null,
      },
      scopes: {
        type: [String],
        default: ["openid", "profile", "email"],
      },
    },
    saml: {
      entryPoint: { type: String, trim: true, default: "", maxlength: 1000 },
      idpIssuer: { type: String, trim: true, default: "", maxlength: 1000 },
      idpSigningCertificate: {
        type: String,
        trim: true,
        default: "",
        maxlength: 20000,
        select: false,
      },
      serviceProviderEntityId: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },
    },
    readiness: {
      staticConfigurationValid: { type: Boolean, default: false },
      domainsVerified: { type: Boolean, default: false },
      credentialReady: { type: Boolean, default: false },
      runtimeAvailable: { type: Boolean, default: false },
      providerAccepted: { type: Boolean, default: false },
      activationAllowed: { type: Boolean, default: false },
      checkedAt: { type: Date, default: null },
      issues: { type: [String], default: [] },
    },
    runtimeEnabled: {
      type: Boolean,
      default: false,
      immutable: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

enterpriseSsoConnectionSchema.index(
  { business: 1, key: 1 },
  { unique: true }
);
enterpriseSsoConnectionSchema.index({ business: 1, status: 1, protocol: 1 });

export default (
  mongoose.models.EnterpriseSsoConnection ||
  mongoose.model("EnterpriseSsoConnection", enterpriseSsoConnectionSchema)
);
