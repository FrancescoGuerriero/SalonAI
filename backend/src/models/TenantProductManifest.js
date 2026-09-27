import mongoose from "mongoose";

import {
  DEPLOYMENT_PROFILES,
  TENANT_PRODUCT_MANIFEST_STATUSES,
  normaliseTenantProductManifest,
} from "../platform/productComposition/tenantProductManifest.js";
import {
  calculateTenantProductManifestHash,
  validateTenantProductManifestForActivation,
} from "../platform/productComposition/tenantProductManifestPersistence.js";

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

tenantProductManifestSchema.pre(
  "validate",
  function validateTenantProductManifestRecord() {
    const input = {
      schemaVersion:
        this.schemaVersion,
      platformVersion:
        this.platformVersion,
      businessId:
        String(
          this.business || ""
        ),
      verticalId:
        this.verticalId,
      planKey:
        this.planKey,
      capabilityPackKeys:
        this.capabilityPackKeys,
      entitlementOverrides:
        this.entitlementOverrides,
      configurationProfile:
        this.configurationProfile,
      themeProfile:
        this.themeProfile,
      terminologyProfile:
        this.terminologyProfile,
      integrationBindings:
        this.integrationBindings,
      aiCapabilityKeys:
        this.aiCapabilityKeys,
      workflowPackKeys:
        this.workflowPackKeys,
      dataPolicyProfile:
        this.dataPolicyProfile,
      approvedExtensionKeys:
        this.approvedExtensionKeys,
      deploymentProfile:
        this.deploymentProfile,
      manifestRevision:
        String(
          this.manifestRevision ||
            1
        ),
      status:
        this.status,
      effectiveFrom:
        this.effectiveFrom
          ? new Date(
              this.effectiveFrom
            ).toISOString()
          : "",
    };

    const normalised =
      this.status ===
        "active"
        ? validateTenantProductManifestForActivation({
            manifest:
              input,
          }).manifest
        : normaliseTenantProductManifest(
            input
          );

    const revision =
      Number(
        normalised.manifestRevision
      );

    if (
      !Number.isInteger(
        revision
      ) ||
      revision < 1
    ) {
      this.invalidate(
        "manifestRevision",
        "Manifest revision must be a positive integer."
      );

      return;
    }

    if (
      this.previousRevision !==
        null &&
      this.previousRevision !==
        undefined &&
      Number(
        this.previousRevision
      ) !==
        revision - 1
    ) {
      this.invalidate(
        "previousRevision",
        "Previous revision must be exactly one less than manifestRevision."
      );

      return;
    }

    this.schemaVersion =
      normalised.schemaVersion;
    this.platformVersion =
      normalised.platformVersion;
    this.verticalId =
      normalised.verticalId;
    this.planKey =
      normalised.planKey;
    this.capabilityPackKeys =
      [
        ...normalised.capabilityPackKeys,
      ];
    this.entitlementOverrides =
      [
        ...normalised.entitlementOverrides,
      ];
    this.configurationProfile =
      normalised.configurationProfile;
    this.themeProfile =
      normalised.themeProfile;
    this.terminologyProfile =
      normalised.terminologyProfile;
    this.integrationBindings =
      [
        ...normalised.integrationBindings,
      ];
    this.aiCapabilityKeys =
      [
        ...normalised.aiCapabilityKeys,
      ];
    this.workflowPackKeys =
      [
        ...normalised.workflowPackKeys,
      ];
    this.dataPolicyProfile =
      normalised.dataPolicyProfile;
    this.approvedExtensionKeys =
      [
        ...normalised.approvedExtensionKeys,
      ];
    this.deploymentProfile =
      normalised.deploymentProfile;
    this.manifestRevision =
      revision;
    this.manifestHash =
      calculateTenantProductManifestHash(
        normalised
      );
  }
);

const TenantProductManifest =
  mongoose.models
    .TenantProductManifest ||
  mongoose.model(
    "TenantProductManifest",
    tenantProductManifestSchema
  );

export default TenantProductManifest;
