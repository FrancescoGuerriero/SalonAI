import mongoose from "mongoose";

const { Schema } = mongoose;

const providerCredentialSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    providerUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    credentialType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    credentialReference: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    jurisdiction: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    regionKeys: {
      type: [String],
      default: [],
      set(value) {
        return [...new Set(
          (Array.isArray(value) ? value : [])
            .map((item) => String(item || "").trim().toLowerCase())
            .filter(Boolean)
        )];
      },
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Provider credential requires at least one regionKey.",
      },
    },
    scopeKeys: {
      type: [String],
      default: [],
      set(value) {
        return [...new Set(
          (Array.isArray(value) ? value : [])
            .map((item) => String(item || "").trim().toLowerCase())
            .filter(Boolean)
        )];
      },
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Provider credential requires at least one scopeKey.",
      },
    },
    status: {
      type: String,
      enum: ["pending", "verified", "suspended", "expired", "revoked"],
      default: "pending",
      index: true,
    },
    validFrom: {
      type: Date,
      default: null,
    },
    validUntil: {
      type: Date,
      default: null,
      index: true,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationEvidence: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

providerCredentialSchema.pre("validate", function validateVerifiedCredential() {
  if (this.status === "verified") {
    if (!this.verifiedBy || !this.verifiedAt || !this.validFrom) {
      const error = new Error(
        "Verified provider credentials require verifier, verification timestamp and validFrom."
      );
      error.code = "CLINICAL_CREDENTIAL_VERIFICATION_EVIDENCE_REQUIRED";
      throw error;
    }
    if (this.validUntil && this.validUntil <= this.validFrom) {
      const error = new Error("Provider credential validUntil must be later than validFrom.");
      error.code = "CLINICAL_CREDENTIAL_VALIDITY_INVALID";
      throw error;
    }
  }
});

providerCredentialSchema.index({
  business: 1,
  providerUser: 1,
  credentialType: 1,
  credentialReference: 1,
}, { unique: true });
providerCredentialSchema.index({ business: 1, status: 1, validUntil: 1 });

export default (
  mongoose.models.ProviderCredential ||
  mongoose.model("ProviderCredential", providerCredentialSchema)
);
