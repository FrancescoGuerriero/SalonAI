import {
  capabilitySupportsVertical,
  getCapabilityPack,
} from "../capabilities/capabilityRegistry.js";
import {
  getVerticalPackDefinition,
} from "../capabilities/verticalPackRegistry.js";

export const TENANT_PRODUCT_MANIFEST_SCHEMA_VERSION = "1";

export const TENANT_PRODUCT_MANIFEST_STATUSES = Object.freeze([
  "draft",
  "active",
  "suspended",
  "archived",
]);

export const DEPLOYMENT_PROFILES = Object.freeze([
  "shared-saas",
  "dedicated",
]);

function compositionError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function cleanString(value) {
  return String(value || "").trim();
}

function cleanKey(value, label) {
  const key = cleanString(value).toLowerCase();

  if (!/^[a-z][a-z0-9-]{1,59}$/.test(key)) {
    throw compositionError(
      `${label} must be 2-60 lowercase letters, numbers or hyphens.`,
      "INVALID_TENANT_PRODUCT_MANIFEST"
    );
  }

  return key;
}

function uniqueKeys(values = [], label) {
  if (!Array.isArray(values)) {
    throw compositionError(
      `${label} must be an array.`,
      "INVALID_TENANT_PRODUCT_MANIFEST"
    );
  }

  return [
    ...new Set(
      values.map((value) => cleanKey(value, label))
    ),
  ];
}

function uniqueStrings(values = []) {
  if (!Array.isArray(values)) {
    throw compositionError(
      "Manifest list fields must be arrays.",
      "INVALID_TENANT_PRODUCT_MANIFEST"
    );
  }

  return [
    ...new Set(
      values
        .map((value) => cleanString(value))
        .filter(Boolean)
    ),
  ];
}

export function normaliseTenantProductManifest(manifest = {}) {
  const schemaVersion = cleanString(
    manifest.schemaVersion ||
      TENANT_PRODUCT_MANIFEST_SCHEMA_VERSION
  );

  if (schemaVersion !== TENANT_PRODUCT_MANIFEST_SCHEMA_VERSION) {
    throw compositionError(
      `Unsupported tenant product manifest schema version "${schemaVersion}".`,
      "UNSUPPORTED_TENANT_PRODUCT_MANIFEST_SCHEMA"
    );
  }

  const businessId = cleanString(manifest.businessId);

  if (!businessId) {
    throw compositionError(
      "Tenant product manifest requires a businessId.",
      "INVALID_TENANT_PRODUCT_MANIFEST"
    );
  }

  const verticalId = cleanKey(
    manifest.verticalId,
    "Vertical id"
  );

  const status = cleanString(
    manifest.status || "draft"
  ).toLowerCase();

  if (!TENANT_PRODUCT_MANIFEST_STATUSES.includes(status)) {
    throw compositionError(
      `Manifest status must be one of: ${TENANT_PRODUCT_MANIFEST_STATUSES.join(", ")}.`,
      "INVALID_TENANT_PRODUCT_MANIFEST"
    );
  }

  const deploymentProfile = cleanString(
    manifest.deploymentProfile || "shared-saas"
  ).toLowerCase();

  if (!DEPLOYMENT_PROFILES.includes(deploymentProfile)) {
    throw compositionError(
      `Deployment profile must be one of: ${DEPLOYMENT_PROFILES.join(", ")}.`,
      "INVALID_TENANT_PRODUCT_MANIFEST"
    );
  }

  return Object.freeze({
    schemaVersion,
    platformVersion: cleanString(
      manifest.platformVersion || ""
    ),
    businessId,
    verticalId,
    planKey: cleanString(manifest.planKey || ""),
    capabilityPackKeys: Object.freeze(
      uniqueKeys(
        manifest.capabilityPackKeys || [],
        "Capability pack key"
      )
    ),
    entitlementOverrides: Object.freeze(
      uniqueStrings(manifest.entitlementOverrides || [])
    ),
    configurationProfile: cleanString(
      manifest.configurationProfile || ""
    ),
    themeProfile: cleanString(
      manifest.themeProfile || ""
    ),
    terminologyProfile: cleanString(
      manifest.terminologyProfile || ""
    ),
    integrationBindings: Object.freeze(
      uniqueStrings(manifest.integrationBindings || [])
    ),
    aiCapabilityKeys: Object.freeze(
      uniqueKeys(
        manifest.aiCapabilityKeys || [],
        "AI capability key"
      )
    ),
    workflowPackKeys: Object.freeze(
      uniqueKeys(
        manifest.workflowPackKeys || [],
        "Workflow pack key"
      )
    ),
    dataPolicyProfile: cleanString(
      manifest.dataPolicyProfile || ""
    ),
    approvedExtensionKeys: Object.freeze(
      uniqueKeys(
        manifest.approvedExtensionKeys || [],
        "Approved extension key"
      )
    ),
    deploymentProfile,
    manifestRevision: cleanString(
      manifest.manifestRevision || "1"
    ),
    status,
    effectiveFrom: cleanString(manifest.effectiveFrom || ""),
  });
}

function validateCapabilityGraph({
  selectedCapabilityKeys,
  verticalId,
}) {
  const selected = new Set(selectedCapabilityKeys);

  for (const capabilityKey of selected) {
    const definition = getCapabilityPack(capabilityKey);

    if (
      definition.status === "retired"
    ) {
      throw compositionError(
        `Capability pack "${capabilityKey}" is retired.`,
        "RETIRED_CAPABILITY_PACK"
      );
    }

    if (
      !capabilitySupportsVertical(
        capabilityKey,
        verticalId
      )
    ) {
      throw compositionError(
        `Capability pack "${capabilityKey}" is not supported by vertical "${verticalId}".`,
        "UNSUPPORTED_VERTICAL_CAPABILITY"
      );
    }

    for (const dependency of definition.dependencies) {
      if (!selected.has(dependency)) {
        throw compositionError(
          `Capability pack "${capabilityKey}" requires "${dependency}".`,
          "MISSING_CAPABILITY_DEPENDENCY"
        );
      }
    }

    for (const conflict of definition.conflicts) {
      if (selected.has(conflict)) {
        throw compositionError(
          `Capability pack "${capabilityKey}" conflicts with "${conflict}".`,
          "CAPABILITY_CONFLICT"
        );
      }
    }
  }
}

export function resolveEffectiveTenantProductComposition({
  manifest,
  entitledCapabilityPackKeys = null,
  featureFlags = {},
  platformDisabledCapabilityPackKeys = [],
} = {}) {
  const normalised = normaliseTenantProductManifest(manifest);
  const vertical = getVerticalPackDefinition(
    normalised.verticalId
  );

  const tenantSelected = new Set(
    normalised.capabilityPackKeys
  );

  const selectedCapabilityKeys = [
    ...new Set([
      ...vertical.defaultCapabilityPackKeys,
      ...normalised.capabilityPackKeys,
    ]),
  ];

  validateCapabilityGraph({
    selectedCapabilityKeys,
    verticalId: vertical.id,
  });

  const entitlementSet = Array.isArray(
    entitledCapabilityPackKeys
  )
    ? new Set(
        uniqueKeys(
          entitledCapabilityPackKeys,
          "Entitled capability pack key"
        )
      )
    : null;

  const disabledByPlatform = new Set(
    uniqueKeys(
      platformDisabledCapabilityPackKeys,
      "Platform-disabled capability pack key"
    )
  );

  const capabilities = selectedCapabilityKeys.map(
    (capabilityKey) => {
      const definition = getCapabilityPack(
        capabilityKey
      );

      const selectionSource = tenantSelected.has(
        capabilityKey
      )
        ? "tenant-manifest"
        : "vertical-default";

      let enabled = true;
      let reason = selectionSource;

      if (disabledByPlatform.has(capabilityKey)) {
        enabled = false;
        reason = "platform-safety-lock";
      } else if (
        entitlementSet &&
        !entitlementSet.has(capabilityKey)
      ) {
        enabled = false;
        reason = "not-entitled";
      } else if (
        Object.prototype.hasOwnProperty.call(
          featureFlags,
          capabilityKey
        ) &&
        featureFlags[capabilityKey] === false
      ) {
        enabled = false;
        reason = "feature-flag-disabled";
      }

      return Object.freeze({
        key: capabilityKey,
        label: definition.label,
        contractVersion:
          definition.contractVersion,
        status: definition.status,
        enabled,
        reason,
        selectionSource,
        dependencies: definition.dependencies,
        requiredPermissions:
          definition.requiredPermissions,
      });
    }
  );

  return Object.freeze({
    manifest: normalised,
    vertical: Object.freeze({
      id: vertical.id,
      label: vertical.label,
      terminology: vertical.terminology,
    }),
    capabilities: Object.freeze(capabilities),
    enabledCapabilityPackKeys: Object.freeze(
      capabilities
        .filter(({ enabled }) => enabled)
        .map(({ key }) => key)
    ),
    disabledCapabilityPackKeys: Object.freeze(
      capabilities
        .filter(({ enabled }) => !enabled)
        .map(({ key }) => key)
    ),
  });
}

export default resolveEffectiveTenantProductComposition;
