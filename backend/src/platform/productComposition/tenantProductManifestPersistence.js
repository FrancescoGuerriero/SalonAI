import {
  createHash,
} from "node:crypto";

import {
  normaliseTenantProductManifest,
  resolveEffectiveTenantProductComposition,
} from "./tenantProductManifest.js";

function persistenceError(
  message,
  code = "INVALID_TENANT_PRODUCT_MANIFEST_REVISION"
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function revisionNumber(
  value
) {
  const text =
    String(
      value || ""
    ).trim();

  if (
    !/^[1-9]\d*$/.test(
      text
    )
  ) {
    throw persistenceError(
      "Tenant product manifest revision must be a positive integer string."
    );
  }

  return Number(text);
}

function canonicalManifestForHash(
  manifest
) {
  return {
    schemaVersion:
      manifest.schemaVersion,
    platformVersion:
      manifest.platformVersion,
    businessId:
      manifest.businessId,
    verticalId:
      manifest.verticalId,
    planKey:
      manifest.planKey,
    capabilityPackKeys: [
      ...manifest.capabilityPackKeys,
    ].sort(),
    entitlementOverrides: [
      ...manifest.entitlementOverrides,
    ].sort(),
    configurationProfile:
      manifest.configurationProfile,
    themeProfile:
      manifest.themeProfile,
    terminologyProfile:
      manifest.terminologyProfile,
    integrationBindings: [
      ...manifest.integrationBindings,
    ].sort(),
    aiCapabilityKeys: [
      ...manifest.aiCapabilityKeys,
    ].sort(),
    workflowPackKeys: [
      ...manifest.workflowPackKeys,
    ].sort(),
    dataPolicyProfile:
      manifest.dataPolicyProfile,
    approvedExtensionKeys: [
      ...manifest.approvedExtensionKeys,
    ].sort(),
    deploymentProfile:
      manifest.deploymentProfile,
    manifestRevision:
      manifest.manifestRevision,
    status:
      manifest.status,
    effectiveFrom:
      manifest.effectiveFrom,
  };
}

export function calculateTenantProductManifestHash(
  manifest
) {
  const normalised =
    normaliseTenantProductManifest(
      manifest
    );

  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify(
        canonicalManifestForHash(
          normalised
        )
      )
    )
    .digest(
      "hex"
    );
}

export function validateTenantProductManifestForActivation({
  manifest,
  entitledCapabilityPackKeys = null,
  featureFlags = {},
  platformDisabledCapabilityPackKeys = [],
} = {}) {
  const normalised =
    normaliseTenantProductManifest(
      manifest
    );

  if (
    normalised.status !==
      "active"
  ) {
    throw persistenceError(
      "Only an active tenant product manifest may pass activation validation.",
      "TENANT_PRODUCT_MANIFEST_NOT_ACTIVE"
    );
  }

  if (
    !normalised.platformVersion
  ) {
    throw persistenceError(
      "An active tenant product manifest requires a platformVersion.",
      "TENANT_PRODUCT_MANIFEST_PLATFORM_VERSION_REQUIRED"
    );
  }

  revisionNumber(
    normalised.manifestRevision
  );

  if (
    normalised.effectiveFrom
  ) {
    const effectiveAt =
      Date.parse(
        normalised.effectiveFrom
      );

    if (
      Number.isNaN(
        effectiveAt
      )
    ) {
      throw persistenceError(
        "Tenant product manifest effectiveFrom must be a valid date/time.",
        "INVALID_TENANT_PRODUCT_MANIFEST_EFFECTIVE_FROM"
      );
    }
  }

  const composition =
    resolveEffectiveTenantProductComposition({
      manifest:
        normalised,
      entitledCapabilityPackKeys,
      featureFlags,
      platformDisabledCapabilityPackKeys,
    });

  return Object.freeze({
    manifest:
      normalised,
    composition,
    manifestHash:
      calculateTenantProductManifestHash(
        normalised
      ),
  });
}

export function buildTenantProductManifestRevision({
  manifest,
  previousManifest = null,
  createdBy = null,
} = {}) {
  const normalised =
    normaliseTenantProductManifest(
      manifest
    );
  const nextRevision =
    revisionNumber(
      normalised.manifestRevision
    );

  let previousRevision =
    null;

  if (
    previousManifest
  ) {
    const previous =
      normaliseTenantProductManifest(
        previousManifest
      );

    if (
      previous.businessId !==
        normalised.businessId
    ) {
      throw persistenceError(
        "A tenant product manifest revision cannot change Business ownership.",
        "TENANT_PRODUCT_MANIFEST_BUSINESS_CONFLICT"
      );
    }

    if (
      previous.verticalId !==
        normalised.verticalId
    ) {
      throw persistenceError(
        "Changing vertical requires an explicit tenant product migration, not a manifest revision.",
        "TENANT_PRODUCT_MANIFEST_VERTICAL_CONFLICT"
      );
    }

    previousRevision =
      revisionNumber(
        previous.manifestRevision
      );

    if (
      nextRevision !==
        previousRevision + 1
    ) {
      throw persistenceError(
        "Tenant product manifest revisions must increase by exactly one.",
        "TENANT_PRODUCT_MANIFEST_REVISION_SEQUENCE"
      );
    }
  }

  const manifestHash =
    calculateTenantProductManifestHash(
      normalised
    );

  return Object.freeze({
    manifest:
      normalised,
    manifestHash,
    previousRevision,
    createdBy:
      createdBy
        ? String(
            createdBy
          )
        : null,
  });
}

export default {
  calculateTenantProductManifestHash,
  validateTenantProductManifestForActivation,
  buildTenantProductManifestRevision,
};
