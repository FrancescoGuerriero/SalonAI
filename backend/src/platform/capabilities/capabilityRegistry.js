const capabilityRegistry = new Map();

export const CAPABILITY_PACK_STATUSES = Object.freeze([
  "experimental",
  "active",
  "deprecated",
  "retired",
]);

function cleanString(value) {
  return String(value || "").trim();
}

function cleanKey(value, label = "Capability pack key") {
  const key = cleanString(value).toLowerCase();

  if (!/^[a-z][a-z0-9-]{1,59}$/.test(key)) {
    throw new TypeError(
      `${label} must be 2-60 lowercase letters, numbers or hyphens.`
    );
  }

  return key;
}

function uniqueKeys(values = [], label) {
  if (!Array.isArray(values)) {
    throw new TypeError(`${label} must be an array.`);
  }

  return Object.freeze([
    ...new Set(
      values
        .map((value) => cleanKey(value, label))
        .filter(Boolean)
    ),
  ]);
}

function normaliseDefinition(definition = {}) {
  const key = cleanKey(definition.key);
  const label = cleanString(definition.label);

  if (!label) {
    throw new TypeError("Capability pack label is required.");
  }

  const status = cleanString(definition.status || "active").toLowerCase();

  if (!CAPABILITY_PACK_STATUSES.includes(status)) {
    throw new TypeError(
      `Capability pack status must be one of: ${CAPABILITY_PACK_STATUSES.join(", ")}.`
    );
  }

  const supportedVerticals = uniqueKeys(
    definition.supportedVerticals || [],
    "Supported vertical id"
  );

  if (supportedVerticals.length === 0) {
    throw new TypeError(
      "Capability pack must declare at least one supported vertical."
    );
  }

  return Object.freeze({
    key,
    label,
    contractVersion: cleanString(definition.contractVersion || "1"),
    status,
    supportedVerticals,
    dependencies: uniqueKeys(
      definition.dependencies || [],
      "Capability dependency"
    ),
    conflicts: uniqueKeys(
      definition.conflicts || [],
      "Capability conflict"
    ),
    requiredPermissions: Object.freeze(
      [
        ...new Set(
          (Array.isArray(definition.requiredPermissions)
            ? definition.requiredPermissions
            : []
          )
            .map((value) => cleanString(value))
            .filter(Boolean)
        ),
      ]
    ),
    configurationDefinitions: Object.freeze(
      [
        ...new Set(
          (Array.isArray(definition.configurationDefinitions)
            ? definition.configurationDefinitions
            : []
          )
            .map((value) => cleanString(value))
            .filter(Boolean)
        ),
      ]
    ),
    integrationContracts: Object.freeze(
      [
        ...new Set(
          (Array.isArray(definition.integrationContracts)
            ? definition.integrationContracts
            : []
          )
            .map((value) => cleanString(value))
            .filter(Boolean)
        ),
      ]
    ),
    meteringKey: cleanString(definition.meteringKey || ""),
  });
}

export function registerCapabilityPack(definition) {
  const normalised = normaliseDefinition(definition);

  if (capabilityRegistry.has(normalised.key)) {
    throw new Error(
      `Capability pack "${normalised.key}" is already registered.`
    );
  }

  capabilityRegistry.set(normalised.key, normalised);
  return normalised;
}

export function isRegisteredCapabilityPack(capabilityKey) {
  return capabilityRegistry.has(cleanKey(capabilityKey));
}

export function getCapabilityPack(capabilityKey) {
  const key = cleanKey(capabilityKey);
  const definition = capabilityRegistry.get(key);

  if (!definition) {
    const error = new Error(
      `Capability pack "${key}" is not registered by this platform build.`
    );
    error.statusCode = 400;
    error.code = "UNKNOWN_CAPABILITY_PACK";
    throw error;
  }

  return definition;
}

export function listCapabilityPacks() {
  return [...capabilityRegistry.values()];
}

export function capabilitySupportsVertical(capabilityKey, verticalId) {
  const definition = getCapabilityPack(capabilityKey);
  const vertical = cleanKey(verticalId, "Vertical id");

  return (
    definition.supportedVerticals.includes("*") ||
    definition.supportedVerticals.includes(vertical)
  );
}

const ALL_SERVICE_VERTICALS = [
  "salon",
  "spa",
  "fitness",
  "plastic-surgery",
];

[
  {
    key: "appointments",
    label: "Appointments & booking",
    supportedVerticals: ALL_SERVICE_VERTICALS,
  },
  {
    key: "staff",
    label: "Workforce & staff",
    supportedVerticals: ALL_SERVICE_VERTICALS,
  },
  {
    key: "services",
    label: "Service catalogue",
    supportedVerticals: ALL_SERVICE_VERTICALS,
  },
  {
    key: "commerce",
    label: "Commerce",
    supportedVerticals: ["salon", "spa", "fitness"],
  },
  {
    key: "communications",
    label: "Communications",
    supportedVerticals: ALL_SERVICE_VERTICALS,
  },
  {
    key: "calendar",
    label: "Calendar integration",
    supportedVerticals: ALL_SERVICE_VERTICALS,
  },
  {
    key: "analytics",
    label: "Analytics & business intelligence",
    supportedVerticals: ALL_SERVICE_VERTICALS,
  },
  {
    key: "ai",
    label: "Shared AI platform",
    supportedVerticals: ALL_SERVICE_VERTICALS,
  },
  {
    key: "memberships",
    label: "Memberships",
    supportedVerticals: ["salon", "spa", "fitness"],
    dependencies: ["commerce"],
  },
  {
    key: "inventory",
    label: "Inventory & purchasing",
    supportedVerticals: ["salon", "spa", "plastic-surgery"],
  },
  {
    key: "loyalty",
    label: "Loyalty",
    supportedVerticals: ["salon", "spa", "fitness"],
    dependencies: ["commerce"],
  },
  {
    key: "ai-receptionist",
    label: "AI Receptionist",
    supportedVerticals: ALL_SERVICE_VERTICALS,
    dependencies: ["ai", "communications", "appointments"],
    requiredPermissions: ["ai:use"],
  },
  {
    key: "ai-retention",
    label: "AI Retention Manager",
    supportedVerticals: ["salon", "spa", "fitness"],
    dependencies: ["ai", "communications", "analytics"],
    requiredPermissions: ["ai:use", "retention-automation:manage"],
  },
  {
    key: "clinical-records",
    label: "Clinical records",
    supportedVerticals: ["plastic-surgery"],
    status: "experimental",
  },
].forEach(registerCapabilityPack);
