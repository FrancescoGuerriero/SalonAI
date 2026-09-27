import {
  createHash,
} from "node:crypto";

import {
  normaliseTenantProductManifest,
} from "./tenantProductManifest.js";
import {
  buildTenantProductManifestRevision,
  calculateTenantProductManifestHash,
  validateTenantProductManifestForActivation,
} from "./tenantProductManifestPersistence.js";
import {
  planTenantProductUpgrade,
} from "./tenantProductUpgradePlan.js";

function activationError(
  message,
  code = "INVALID_TENANT_PRODUCT_ACTIVATION"
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function fingerprint(
  value
) {
  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify(
        value
      )
    )
    .digest(
      "hex"
    );
}

function activeCandidate(
  manifest
) {
  return {
    ...manifest,
    status: "active",
  };
}

export function planTenantProductManifestActivation({
  candidateManifest,
  currentActiveManifest = null,
  entitledCapabilityPackKeys = null,
  featureFlags = {},
  platformDisabledCapabilityPackKeys = [],
} = {}) {
  const candidate =
    normaliseTenantProductManifest(
      candidateManifest
    );

  if (
    candidate.status !==
      "draft"
  ) {
    throw activationError(
      "A tenant product activation candidate must be in draft status.",
      "TENANT_PRODUCT_ACTIVATION_REQUIRES_DRAFT"
    );
  }

  const proposedActive =
    activeCandidate(
      candidate
    );

  let current =
    null;
  let upgradePlan =
    null;
  let revisionContract =
    null;

  if (
    currentActiveManifest
  ) {
    current =
      normaliseTenantProductManifest(
        currentActiveManifest
      );

    if (
      current.status !==
        "active"
    ) {
      throw activationError(
        "The current tenant product manifest must be active.",
        "TENANT_PRODUCT_CURRENT_MANIFEST_NOT_ACTIVE"
      );
    }

    revisionContract =
      buildTenantProductManifestRevision({
        previousManifest:
          current,
        manifest:
          proposedActive,
      });

    upgradePlan =
      planTenantProductUpgrade({
        currentManifest:
          current,
        nextManifest:
          proposedActive,
        currentEntitledCapabilityPackKeys:
          entitledCapabilityPackKeys,
        nextEntitledCapabilityPackKeys:
          entitledCapabilityPackKeys,
        currentFeatureFlags:
          featureFlags,
        nextFeatureFlags:
          featureFlags,
        currentPlatformDisabledCapabilityPackKeys:
          platformDisabledCapabilityPackKeys,
        nextPlatformDisabledCapabilityPackKeys:
          platformDisabledCapabilityPackKeys,
      });
  } else {
    if (
      candidate.manifestRevision !==
        "1"
    ) {
      throw activationError(
        "The first active tenant product manifest must use revision 1.",
        "TENANT_PRODUCT_INITIAL_REVISION_REQUIRED"
      );
    }

    revisionContract =
      buildTenantProductManifestRevision({
        manifest:
          proposedActive,
      });
  }

  const activation =
    validateTenantProductManifestForActivation({
      manifest:
        proposedActive,
      entitledCapabilityPackKeys,
      featureFlags,
      platformDisabledCapabilityPackKeys,
    });

  const approvalReasons = [];

  if (!current) {
    approvalReasons.push(
      "initial-tenant-product-activation"
    );
  }

  if (
    upgradePlan?.requiresTenantAcceptance
  ) {
    approvalReasons.push(
      "tenant-product-change"
    );
  }

  if (
    upgradePlan?.requiresPlatformUpgradeReview
  ) {
    approvalReasons.push(
      "platform-version-upgrade-review"
    );
  }

  if (
    upgradePlan?.requiresInfrastructureReview ||
    candidate.deploymentProfile ===
      "dedicated"
  ) {
    approvalReasons.push(
      "deployment-infrastructure-review"
    );
  }

  if (
    upgradePlan?.containsExperimentalCapability ||
    activation.composition.capabilities.some(
      (capability) =>
        capability.enabled &&
        capability.status ===
          "experimental"
    )
  ) {
    approvalReasons.push(
      "experimental-capability"
    );
  }

  const persistenceOperations = [];

  if (current) {
    persistenceOperations.push(
      Object.freeze({
        type:
          "archive-current-manifest",
        businessId:
          current.businessId,
        revision:
          current.manifestRevision,
        expectedManifestHash:
          calculateTenantProductManifestHash(
            current
          ),
      })
    );
  }

  persistenceOperations.push(
    Object.freeze({
      type:
        "activate-candidate-manifest",
      businessId:
        candidate.businessId,
      revision:
        candidate.manifestRevision,
      expectedDraftManifestHash:
        calculateTenantProductManifestHash(
          candidate
        ),
      activeManifestHash:
        activation.manifestHash,
    })
  );

  const activationFingerprint =
    fingerprint({
      businessId:
        candidate.businessId,
      verticalId:
        candidate.verticalId,
      fromRevision:
        current?.manifestRevision ||
        null,
      toRevision:
        candidate.manifestRevision,
      candidateDraftHash:
        calculateTenantProductManifestHash(
          candidate
        ),
      activeManifestHash:
        activation.manifestHash,
      upgradeFingerprint:
        upgradePlan?.upgradeFingerprint ||
        null,
      approvalReasons:
        [...approvalReasons].sort(),
      persistenceOperations,
    });

  return Object.freeze({
    businessId:
      candidate.businessId,
    verticalId:
      candidate.verticalId,
    fromRevision:
      current?.manifestRevision ||
      null,
    toRevision:
      candidate.manifestRevision,
    currentManifestHash:
      current
        ? calculateTenantProductManifestHash(
            current
          )
        : null,
    candidateDraftManifestHash:
      calculateTenantProductManifestHash(
        candidate
      ),
    activeManifestHash:
      activation.manifestHash,
    enabledCapabilityPackKeys:
      activation.composition
        .enabledCapabilityPackKeys,
    disabledCapabilityPackKeys:
      activation.composition
        .disabledCapabilityPackKeys,
    upgradePlan,
    approvalRequired:
      approvalReasons.length >
      0,
    approvalReasons:
      Object.freeze([
        ...approvalReasons,
      ]),
    persistenceOperations:
      Object.freeze(
        persistenceOperations
      ),
    activationFingerprint,
    writesPerformed:
      false,
    revisionContract,
  });
}

export default planTenantProductManifestActivation;
