import mongoose from "mongoose";

import {
  DEPLOYMENT_PROFILES,
  TENANT_PRODUCT_MANIFEST_STATUSES,
} from "../platform/productComposition/tenantProductManifest.js";

const {
  Schema,
} = mongoose;

const tenantProductManifestSchema =
  new Schema(
    {
      business: {
        type:
          Schema.Types.ObjectId,
        ref:
          "Business",
        required:
          true,
        index:
          true,
      },

      schemaVersion: {
        type:
          String,
        required:
          true,
        trim:
          true,
      },

      platformVersion: {
        type:
          String,
        default:
          "",
        trim:
          true,
      },

      verticalId: {
        type:
          String,
        required:
          true,
        trim:
          true,
        lowercase:
          true,
        index:
          true,
      },

      planKey: {
        type:
          String,
        default:
          "",
        trim:
          true,
      },

      capabilityPackKeys: {
        type: [
          String,
        ],
        default:
          [],
      },

      entitlementOverrides: {
        type: [
          String,
        ],
        default:
          [],
      },

      configurationProfile: {
        type:
          String,
        default:
          "",
        trim:
          true,
      },

      themeProfile: {
        type:
          String,
        default:
          "",
        trim:
          true,
      },

      terminologyProfile: {
        type:
          String,
        default:
          "",
        trim:
          true,
      },

      integrationBindings: {
        type: [
          String,
        ],
        default:
          [],
      },

      aiCapabilityKeys: {
        type: [
          String,
        ],
        default:
          [],
      },

      workflowPackKeys: {
        type: [
          String,
        ],
        default:
          [],
      },

      dataPolicyProfile: {
        type:
          String,
        default:
          "",
        trim:
          true,
      },

      approvedExtensionKeys: {
        type: [
          String,
        ],
        default:
          [],
      },

      deploymentProfile: {
        type:
          String,
        enum:
          DEPLOYMENT_PROFILES,
        default:
          "shared-saas",
        index:
          true,
      },

      manifestRevision: {
        type:
          Number,
        required:
          true,
        min:
          1,
      },

      manifestHash: {
        type:
          String,
        required:
          true,
        trim:
          true,
        lowercase:
          true,
        match: [
          /^[a-f0-9]{64}$/,
          "Manifest hash must be a SHA-256 hex digest.",
        ],
      },

      status: {
        type:
          String,
        enum:
          TENANT_PRODUCT_MANIFEST_STATUSES,
        default:
          "draft",
        index:
          true,
      },

      effectiveFrom: {
        type:
          Date,
        default:
          null,
      },

      previousRevision: {
        type:
          Number,
        default:
          null,
        min:
          1,
      },

      createdBy: {
        type:
          Schema.Types.ObjectId,
        ref:
          "User",
        default:
          null,
      },

      updatedBy: {
        type:
          Schema.Types.ObjectId,
        ref:
          "User",
        default:
          null,
      },
    },
    {
      timestamps:
        true,
    }
  );

tenantProductManifestSchema.index(
  {
    business:
      1,
    manifestRevision:
      1,
  },
  {
    unique:
      true,
  }
);

tenantProductManifestSchema.index(
  {
    business:
      1,
    status:
      1,
  },
  {
    unique:
      true,
    partialFilterExpression:
      {
        status:
          "active",
      },
  }
);

tenantProductManifestSchema.index({
  verticalId:
    1,
  status:
    1,
});

const TenantProductManifest =
  mongoose.models
    .TenantProductManifest ||
  mongoose.model(
    "TenantProductManifest",
    tenantProductManifestSchema
  );

export default TenantProductManifest;
