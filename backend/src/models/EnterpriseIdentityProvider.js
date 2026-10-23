import mongoose from "mongoose";

const { Schema } = mongoose;

export const ENTERPRISE_SSO_PROTOCOLS = Object.freeze(["oidc", "saml"]);
export const ENTERPRISE_SSO_STATUSES = Object.freeze(["draft", "configured", "disabled"]);
export const ENTERPRISE_SSO_ENFORCEMENT_MODES = Object.freeze(["disabled", "optional"]);

const oidcSchema = new Schema(
  {
    issuer: { type: String, trim: true, default: "", maxlength: 1000 },
    discoveryUrl: { type: String, trim: true, default: "", maxlength: 1500 },
    clientId: { type: String, trim: true, default: "", maxlength: 500 },
    clientSecretCredential: {
      type: Schema.Types.ObjectId,
      ref: "CredentialVersion",
      default: null,
    },
  },
  { _id: false }
);

const samlSchema = new Schema(
  {
    entityId: { type: String, trim: true, default: "", maxlength: 1000 },
    ssoUrl: { type: String, trim: true, default: "", maxlength: 1500 },
    metadataUrl: { type: String, trim: true, default: "", maxlength: 1500 },
    signingCertificatePem: {
      type: String,
      default: "",
      select: false,
      maxlength: 20000,
    },
    signingCertificateFingerprint: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      match: [/^$|^[a-f0-9]{64}$/, "SAML certificate fingerprint must be SHA-256 hex."],
    },
  },
  { _id: false }
);

const enterpriseIdentityProviderSchema = new Schema(
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
    enforcementMode: {
      type: String,
      enum: ENTERPRISE_SSO_ENFORCEMENT_MODES,
      default: "disabled",
    },
    verifiedDomains: {
      type: [String],
      default: [],
      set(values) {
        return [
          ...new Set(
            (Array.isArray(values) ? values : [])
              .map((value) => String(value).trim().toLowerCase())
              .filter(Boolean)
          ),
        ];
      },
    },
    accountLinkingPolicy: {
      type: String,
      enum: ["existing_user_only"],
      default: "existing_user_only",
    },
    jitProvisioningEnabled: { type: Boolean, default: false },
    runtimeAuthenticationEnabled: { type: Boolean, default: false },
    oidc: { type: oidcSchema, default: () => ({}) },
    saml: { type: samlSchema, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

enterpriseIdentityProviderSchema.pre("validate", function guardFoundationRuntime() {
  if (this.jitProvisioningEnabled) {
    this.invalidate(
      "jitProvisioningEnabled",
      "Enterprise SSO JIT provisioning is not enabled in the foundation release."
    );
  }
  if (this.runtimeAuthenticationEnabled) {
    this.invalidate(
      "runtimeAuthenticationEnabled",
      "Enterprise SSO authentication runtime is not activated in the foundation release."
    );
  }
  if (this.status === "configured") {
    if (!this.verifiedDomains?.length) {
      this.invalidate(
        "verifiedDomains",
        "Configured Enterprise SSO requires at least one verified tenant domain."
      );
    }
    if (
      this.protocol === "oidc" &&
      (!this.oidc?.issuer ||
        !this.oidc?.clientId ||
        !this.oidc?.clientSecretCredential)
    ) {
      this.invalidate(
        "oidc",
        "Configured OIDC requires issuer, client ID and a versioned client-secret credential reference."
      );
    }
    if (
      this.protocol === "saml" &&
      (!this.saml?.entityId ||
        !(this.saml?.ssoUrl || this.saml?.metadataUrl) ||
        !this.saml?.signingCertificatePem ||
        !this.saml?.signingCertificateFingerprint)
    ) {
      this.invalidate(
        "saml",
        "Configured SAML requires entity ID, SSO or metadata URL, and public signing-certificate trust material."
      );
    }
  }
});

enterpriseIdentityProviderSchema.index(
  { business: 1, key: 1 },
  { unique: true }
);
enterpriseIdentityProviderSchema.index({ business: 1, status: 1, protocol: 1 });

export default (
  mongoose.models.EnterpriseIdentityProvider ||
  mongoose.model("EnterpriseIdentityProvider", enterpriseIdentityProviderSchema)
);
