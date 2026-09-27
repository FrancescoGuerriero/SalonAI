import {
  createHash,
} from "node:crypto";

import {
  getCapabilityPack,
} from "../capabilities/capabilityRegistry.js";
import {
  resolveEffectiveTenantProductComposition,
} from "./tenantProductManifest.js";
import {
  buildTenantProductManifestRevision,
  calculateTenantProductManifestHash,
} from "./tenantProductManifestPersistence.js";

function sortedUnique(
  values = []
) {
  return [
    ...new Set(
      (
        Array.isArray(values)
          ? values
          : []
      )
        .map(
          (value) =>
            String(
              value || ""
            ).trim()
        )
        .filter(Boolean)
    ),
  ].sort();
}

function difference(
  left,
  right
) {
  const rightSet =
    new Set(
      right
    );

  return left.filter(
    (value) =>
      !rightSet.has(
        value
      )
  );
}

function changedScalar(
  current,
  next
) {
  return String(
    current || ""
  ) !==
    String(
      next || ""
    );
}

function profileChanges(
  current,
  next
) {
  const scalarFields = [
    "platformVersion",
    "planKey",
    "configurationProfile",
    "themeProfile",
    "terminologyProfile",
    "dataPolicyProfile",
    "deploymentProfile",
    "effectiveFrom",
  ];

  const listFields = [
    "entitlementOverrides",
    "integrationBindings",
    "aiCapabilityKeys",
    "workflowPackKeys",
    "approvedExtensionKeys",
  ];

  const changes = [];

  for (
    const field of
      scalarFields
  ) {
    if (
      changedScalar(
        current[field],
        next[field]
      )
    ) {
      changes.push({
        field,
        from:
          current[field] ||
          "",
        to:
          next[field] ||
          "",
      });
    }
  }

  for (
    const field of
      listFields
  ) {
    const before =
      sortedUnique(
        current[field]
      );
    const after =
      sortedUnique(
        next[field]
      );

    if (
      JSON.stringify(
        before
      ) !==
      JSON.stringify(
        after
      )
    ) {
      changes.push({
        field,
        added:
          difference(
            after,
            before
          ),
        removed:
          difference(
            before,
            after
          ),
      });
    }
  }

  return changes;
}

function stateMap(
  composition
) {
  return new Map(
    composition.capabilities.map(
      (state) => [
        state.key,
        state,
      ]
    )
  );
}

function capabilityDelta(
  currentComposition,
  nextComposition
) {
  const current =
    stateMap(
      currentComposition
    );
  const next =
    stateMap(
      nextComposition
    );

  const keys =
    sortedUnique([
      ...current.keys(),
      ...next.keys(),
    ]);

  const transitions = [];

  for (
    const key of
      keys
  ) {
    const before =
      current.get(
        key
      ) || null;
    const after =
      next.get(
        key
      ) || null;

    const beforeEnabled =
      Boolean(
        before?.enabled
      );
    const afterEnabled =
      Boolean(
        after?.enabled
      );

    const beforeReason =
      before?.reason ||
      "not-selected";
    const afterReason =
      after?.reason ||
      "not-selected";

    if (
      beforeEnabled ===
        afterEnabled &&
      beforeReason ===
        afterReason &&
      Boolean(before) ===
        Boolean(after)
    ) {
      continue;
    }

    const definition =
      getCapabilityPack(
        key
      );

    transitions.push({
      key,
      label:
        definition.label,
      status:
        definition.status,
      fromEnabled:
        beforeEnabled,
      toEnabled:
        afterEnabled,
      fromReason:
        beforeReason,
      toReason:
        afterReason,
      requiredPermissions:
        definition.requiredPermissions,
      integrationContracts:
        definition.integrationContracts,
      meteringKey:
        definition.meteringKey,
    });
  }

  return transitions;
}

function fingerprintPayload(
  plan
) {
  return {
    businessId:
      plan.businessId,
    verticalId:
      plan.verticalId,
    fromRevision:
      plan.fromRevision,
    toRevision:
      plan.toRevision,
    currentManifestHash:
      plan.currentManifestHash,
    nextManifestHash:
      plan.nextManifestHash,
    capabilityTransitions:
      plan.capabilityTransitions,
    profileChanges:
      plan.profileChanges,
    requiresTenantAcceptance:
      plan.requiresTenantAcceptance,
    requiresInfrastructureReview:
      plan.requiresInfrastructureReview,
    requiresPlatformUpgradeReview:
      plan.requiresPlatformUpgradeReview,
    containsExperimentalCapability:
      plan.containsExperimentalCapability,
  };
}

export function planTenantProductUpgrade({
  currentManifest,
  nextManifest,
  currentEntitledCapabilityPackKeys = null,
  nextEntitledCapabilityPackKeys = null,
  currentFeatureFlags = {},
  nextFeatureFlags = {},
  currentPlatformDisabledCapabilityPackKeys = [],
  nextPlatformDisabledCapabilityPackKeys = [],
} = {}) {
  const revision =
    buildTenantProductManifestRevision({
      previousManifest:
        currentManifest,
      manifest:
        nextManifest,
    });

  const currentComposition =
    resolveEffectiveTenantProductComposition({
      manifest:
        currentManifest,
      entitledCapabilityPackKeys:
        currentEntitledCapabilityPackKeys,
      featureFlags:
        currentFeatureFlags,
      platformDisabledCapabilityPackKeys:
        currentPlatformDisabledCapabilityPackKeys,
    });

  const nextComposition =
    resolveEffectiveTenantProductComposition({
      manifest:
        revision.manifest,
      entitledCapabilityPackKeys:
        nextEntitledCapabilityPackKeys,
      featureFlags:
        nextFeatureFlags,
      platformDisabledCapabilityPackKeys:
        nextPlatformDisabledCapabilityPackKeys,
    });

  const transitions =
    capabilityDelta(
      currentComposition,
      nextComposition
    );

  const profiles =
    profileChanges(
      currentComposition.manifest,
      nextComposition.manifest
    );

  const enabling =
    transitions.filter(
      (transition) =>
        !transition.fromEnabled &&
        transition.toEnabled
    );
  const disabling =
    transitions.filter(
      (transition) =>
        transition.fromEnabled &&
        !transition.toEnabled
    );

  const containsExperimentalCapability =
    enabling.some(
      (transition) =>
        transition.status ===
        "experimental"
    );

  const requiresInfrastructureReview =
    profiles.some(
      (change) =>
        change.field ===
          "deploymentProfile"
    );

  const requiresPlatformUpgradeReview =
    profiles.some(
      (change) =>
        change.field ===
          "platformVersion"
    );

  const requiresTenantAcceptance =
    transitions.length >
      0 ||
    profiles.length >
      0;

  const basePlan = {
    businessId:
      revision.manifest.businessId,
    verticalId:
      revision.manifest.verticalId,
    fromRevision:
      String(
        currentComposition.manifest
          .manifestRevision
      ),
    toRevision:
      String(
        nextComposition.manifest
          .manifestRevision
      ),
    currentManifestHash:
      calculateTenantProductManifestHash(
        currentComposition.manifest
      ),
    nextManifestHash:
      revision.manifestHash,
    capabilityTransitions:
      Object.freeze(
        transitions.map(
          (transition) =>
            Object.freeze({
              ...transition,
              requiredPermissions:
                Object.freeze([
                  ...transition.requiredPermissions,
                ]),
              integrationContracts:
                Object.freeze([
                  ...transition.integrationContracts,
                ]),
            })
        )
      ),
    capabilitiesToEnable:
      Object.freeze(
        enabling.map(
          ({ key }) => key
        )
      ),
    capabilitiesToDisable:
      Object.freeze(
        disabling.map(
          ({ key }) => key
        )
      ),
    profileChanges:
      Object.freeze(
        profiles.map(
          (change) =>
            Object.freeze({
              ...change,
              ...(change.added
                ? {
                    added:
                      Object.freeze([
                        ...change.added,
                      ]),
                  }
                : {}),
              ...(change.removed
                ? {
                    removed:
                      Object.freeze([
                        ...change.removed,
                      ]),
                  }
                : {}),
            })
        )
      ),
    requiresTenantAcceptance,
    requiresInfrastructureReview,
    requiresPlatformUpgradeReview,
    containsExperimentalCapability,
    writesPerformed:
      false,
  };

  const upgradeFingerprint =
    createHash(
      "sha256"
    )
      .update(
        JSON.stringify(
          fingerprintPayload(
            basePlan
          )
        )
      )
      .digest(
        "hex"
      );

  return Object.freeze({
    ...basePlan,
    upgradeFingerprint,
  });
}

export default planTenantProductUpgrade;
