import mongoose from "mongoose";

import {
  normaliseTenantHost,
} from "../platform/tenancy/tenantHost.js";

const { Schema } = mongoose;

export const BUSINESS_DOMAIN_STATUSES =
  Object.freeze([
    "pending",
    "active",
    "disabled",
  ]);

export const BUSINESS_DOMAIN_ROLES =
  Object.freeze([
    "primary",
    "alias",
    "app-subdomain",
  ]);

const verificationSchema =
  new Schema(
    {
      method: {
        type: String,
        enum: [
          "manual",
          "dns",
          "platform",
        ],
        default: "manual",
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
      checkedAt: {
        type: Date,
        default: null,
      },
    },
    {
      _id: false,
    }
  );

const businessDomainSchema =
  new Schema(
    {
      business: {
        type: Schema.Types.ObjectId,
        ref: "Business",
        required: true,
        index: true,
      },

      host: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        maxlength: 253,
      },

      status: {
        type: String,
        enum:
          BUSINESS_DOMAIN_STATUSES,
        default: "pending",
        index: true,
      },

      role: {
        type: String,
        enum:
          BUSINESS_DOMAIN_ROLES,
        default: "alias",
        index: true,
      },

      redirectToPrimary: {
        type: Boolean,
        default: false,
      },

      verification: {
        type: verificationSchema,
        default: () => ({}),
      },

      metadata: {
        type: Schema.Types.Mixed,
        default: () => ({}),
      },
    },
    {
      timestamps: true,
    }
  );

businessDomainSchema.pre(
  "validate",
  function normaliseBusinessDomain() {
    this.host =
      normaliseTenantHost(
        this.host
      );

    if (
      this.role === "primary"
    ) {
      this.redirectToPrimary =
        false;
    }
  }
);

businessDomainSchema.index(
  {
    business: 1,
    status: 1,
  }
);

businessDomainSchema.index(
  {
    business: 1,
    role: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      role: "primary",
      status: "active",
    },
  }
);

const BusinessDomain =
  mongoose.models.BusinessDomain ||
  mongoose.model(
    "BusinessDomain",
    businessDomainSchema
  );

export default BusinessDomain;
