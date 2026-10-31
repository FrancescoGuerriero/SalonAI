const capabilityRegistry = new Map();

export const CAPABILITY_PACK_STATUSES = Object.freeze([
  "experimental",
  "active",
  "deprecated",
  "retired",
]);

export const CAPABILITY_MODULE_CLASSES = Object.freeze([
  "operations",
  "integration",
  "data",
  "analytics",
  "automation",
  "ai-foundation",
  "ai-assistant",
  "specialist",
  "bundle",
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

function uniqueKeys(values = [], label, { allowWildcard = false } = {}) {
  if (!Array.isArray(values)) {
    throw new TypeError(`${label} must be an array.`);
  }

  return Object.freeze([
    ...new Set(
      values
        .map((value) => {
          const cleaned = cleanString(value).toLowerCase();
          if (allowWildcard && cleaned === "*") return "*";
          return cleanKey(cleaned, label);
        })
        .filter(Boolean)
    ),
  ]);
}

function normaliseDefinition(definition = {}) {
  const key = cleanKey(definition.key);
  const label = cleanString(definition.label);
  if (!label) throw new TypeError("Capability pack label is required.");

  const status = cleanString(definition.status || "active").toLowerCase();
  if (!CAPABILITY_PACK_STATUSES.includes(status)) {
    throw new TypeError(
      `Capability pack status must be one of: ${CAPABILITY_PACK_STATUSES.join(", ")}.`
    );
  }

  const moduleClass = cleanString(definition.moduleClass || "operations").toLowerCase();
  if (!CAPABILITY_MODULE_CLASSES.includes(moduleClass)) {
    throw new TypeError(
      `Capability module class must be one of: ${CAPABILITY_MODULE_CLASSES.join(", ")}.`
    );
  }

  const supportedVerticals = uniqueKeys(
    definition.supportedVerticals || [],
    "Supported vertical id",
    { allowWildcard: true }
  );
  if (supportedVerticals.length === 0) {
    throw new TypeError("Capability pack must declare at least one supported vertical.");
  }

  return Object.freeze({
    key,
    label,
    contractVersion: cleanString(definition.contractVersion || "1"),
    status,
    moduleClass,
    businessPurpose: cleanString(definition.businessPurpose || label),
    allocatable: definition.allocatable !== false,
    decisionSupportOnly: Boolean(definition.decisionSupportOnly),
    supportedVerticals,
    ownedDomains: uniqueKeys(definition.ownedDomains || [], "Owned domain"),
    consumesDomains: uniqueKeys(definition.consumesDomains || [], "Consumed domain"),
    dependencies: uniqueKeys(definition.dependencies || [], "Capability dependency"),
    conflicts: uniqueKeys(definition.conflicts || [], "Capability conflict"),
    requiredPermissions: Object.freeze([
      ...new Set(
        (Array.isArray(definition.requiredPermissions) ? definition.requiredPermissions : [])
          .map((value) => cleanString(value))
          .filter(Boolean)
      ),
    ]),
    configurationDefinitions: Object.freeze([
      ...new Set(
        (Array.isArray(definition.configurationDefinitions) ? definition.configurationDefinitions : [])
          .map((value) => cleanString(value))
          .filter(Boolean)
      ),
    ]),
    integrationContracts: Object.freeze([
      ...new Set(
        (Array.isArray(definition.integrationContracts) ? definition.integrationContracts : [])
          .map((value) => cleanString(value))
          .filter(Boolean)
      ),
    ]),
    meteringKey: cleanString(definition.meteringKey || ""),
  });
}

export function registerCapabilityPack(definition) {
  const normalised = normaliseDefinition(definition);
  if (capabilityRegistry.has(normalised.key)) {
    throw new Error(`Capability pack "${normalised.key}" is already registered.`);
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
    const error = new Error(`Capability pack "${key}" is not registered by this platform build.`);
    error.statusCode = 400;
    error.code = "UNKNOWN_CAPABILITY_PACK";
    throw error;
  }
  return definition;
}

export function listCapabilityPacks() {
  return [...capabilityRegistry.values()];
}

export function listAllocatableCapabilityPacks() {
  return listCapabilityPacks().filter(
    (capability) => capability.allocatable && capability.status !== "retired"
  );
}

export function capabilitySupportsVertical(capabilityKey, verticalId) {
  const definition = getCapabilityPack(capabilityKey);
  const vertical = cleanKey(verticalId, "Vertical id");
  return (
    definition.supportedVerticals.includes("*") ||
    definition.supportedVerticals.includes(vertical)
  );
}

const SERVICE_VERTICALS = Object.freeze([
  "salon",
  "spa",
  "fitness",
  "plastic-surgery",
]);

const BUSINESS_VERTICALS = Object.freeze([
  ...SERVICE_VERTICALS,
  "retail",
]);

[
  {
    key: "appointments",
    label: "Appointments & booking",
    moduleClass: "operations",
    businessPurpose: "Own booking, availability and appointment lifecycle state.",
    ownedDomains: ["booking", "availability", "appointment-lifecycle"],
    supportedVerticals: SERVICE_VERTICALS,
  },
  {
    key: "staff",
    label: "Workforce & staff",
    moduleClass: "operations",
    businessPurpose: "Own workforce, staff profiles and staff/resource assignment state.",
    ownedDomains: ["workforce", "staff-profile", "staff-assignment"],
    supportedVerticals: SERVICE_VERTICALS,
  },
  {
    key: "services",
    label: "Service catalogue",
    moduleClass: "operations",
    businessPurpose: "Own the business service/procedure catalogue and service configuration.",
    ownedDomains: ["service-catalogue", "service-configuration"],
    supportedVerticals: SERVICE_VERTICALS,
  },
  {
    key: "commerce",
    label: "Commerce",
    moduleClass: "operations",
    businessPurpose: "Own checkout, payments, orders, refunds and commercial transaction state.",
    ownedDomains: ["orders", "payments", "checkout", "refunds"],
    supportedVerticals: ["salon", "spa", "fitness", "retail"],
  },
  {
    key: "communications",
    label: "Communications",
    moduleClass: "integration",
    businessPurpose: "Own consent-aware inbound/outbound transactional and marketing message delivery across approved email, SMS, WhatsApp and future channels.",
    ownedDomains: ["message-delivery", "communication-channel"],
    supportedVerticals: BUSINESS_VERTICALS,
  },
  {
    key: "calendar",
    label: "Calendar integration",
    moduleClass: "integration",
    businessPurpose: "Connect staff/customer calendars while Appointments remains canonical booking authority.",
    ownedDomains: ["calendar-connection", "calendar-sync"],
    consumesDomains: ["booking"],
    dependencies: ["appointments"],
    supportedVerticals: SERVICE_VERTICALS,
  },
  {
    key: "analytics",
    label: "Analytics & business intelligence",
    moduleClass: "analytics",
    businessPurpose: "Own governed metrics, dashboards and analytical read models without becoming operational source of truth.",
    ownedDomains: ["metric-catalogue", "business-intelligence", "analytical-projection"],
    supportedVerticals: BUSINESS_VERTICALS,
  },
  {
    key: "ai",
    label: "Shared AI platform",
    moduleClass: "ai-foundation",
    businessPurpose: "Provide governed general, vertical, tenant-specific and continuously evaluated ML foundations, provenance and approved AI tools.",
    ownedDomains: ["ai-inference", "ai-provenance", "ai-tool-governance"],
    allocatable: false,
    supportedVerticals: BUSINESS_VERTICALS,
  },
  {
    key: "integrations",
    label: "Integration Hub",
    moduleClass: "integration",
    businessPurpose: "Connect external business platforms through reusable provider credentials, account selection, connection health and sync contracts.",
    ownedDomains: ["provider-connection", "provider-credential", "integration-sync"],
    supportedVerticals: BUSINESS_VERTICALS,
    integrationContracts: ["provider-connections"],
  },
  {
    key: "marketing-data",
    label: "Marketing Data Engine",
    moduleClass: "data",
    businessPurpose: "Internal provider-neutral ingestion, normalisation and lineage engine for marketing evidence.",
    ownedDomains: ["marketing-ingestion", "marketing-normalised-data", "marketing-lineage"],
    consumesDomains: ["provider-connection"],
    allocatable: false,
    supportedVerticals: BUSINESS_VERTICALS,
    dependencies: ["integrations"],
    integrationContracts: ["marketing-data-core"],
  },
  {
    key: "campaigns-attribution",
    label: "Campaign & Attribution Engine",
    moduleClass: "data",
    businessPurpose: "Internal canonical campaign execution, social publication, performance and deterministic attribution engine.",
    ownedDomains: ["campaign", "campaign-execution", "social-publication", "marketing-attribution"],
    consumesDomains: ["marketing-normalised-data"],
    allocatable: false,
    supportedVerticals: BUSINESS_VERTICALS,
    dependencies: ["marketing-data"],
  },
  {
    key: "crm",
    label: "CRM & customer intelligence",
    moduleClass: "operations",
    businessPurpose: "Own Customer 360, customer relationship history, lifecycle classification, segmentation and retention journey definitions/outcomes independently from Marketing.",
    ownedDomains: ["customer-360", "customer-lifecycle", "customer-segmentation", "retention-journey"],
    consumesDomains: ["business-intelligence", "marketing-attribution"],
    supportedVerticals: BUSINESS_VERTICALS,
    dependencies: ["analytics"],
    configurationDefinitions: ["customer-lifecycle", "customer-segmentation"],
  },
  {
    key: "marketing-automation",
    label: "Marketing Automation Engine",
    moduleClass: "automation",
    businessPurpose: "Internal trigger, approval, schedule and multi-channel orchestration engine that consumes CRM audiences and requests delivery from Communications.",
    ownedDomains: ["marketing-trigger", "marketing-automation-policy", "marketing-automation-run"],
    consumesDomains: ["customer-segmentation", "retention-journey", "campaign", "campaign-execution", "message-delivery", "marketing-normalised-data"],
    allocatable: false,
    supportedVerticals: BUSINESS_VERTICALS,
    dependencies: ["crm", "communications", "analytics", "campaigns-attribution", "marketing-data"],
    requiredPermissions: ["retention-automation:manage"],
    configurationDefinitions: ["campaign-automation", "journey-automation"],
    integrationContracts: ["campaign-execution", "marketing-attribution"],
  },
  {
    key: "marketing",
    label: "Marketing",
    moduleClass: "bundle",
    businessPurpose: "Business-facing advertising, audiences, campaigns, attribution and automation workspace. CRM remains customer authority and Communications remains email/SMS/WhatsApp delivery authority.",
    ownedDomains: ["marketing-module-experience"],
    consumesDomains: ["marketing-normalised-data", "campaign", "marketing-attribution", "customer-segmentation", "marketing-automation-run", "message-delivery"],
    supportedVerticals: BUSINESS_VERTICALS,
    dependencies: ["marketing-automation", "integrations"],
    requiredPermissions: ["retention-automation:manage"],
  },
  {
    key: "ai-decision-support",
    label: "AI Business Adviser",
    moduleClass: "ai-assistant",
    businessPurpose: "Assist managers with evidence-grounded business decisions while humans remain decision owners and canonical state remains unchanged.",
    ownedDomains: ["business-advice"],
    consumesDomains: ["business-intelligence", "analytical-projection"],
    decisionSupportOnly: true,
    supportedVerticals: BUSINESS_VERTICALS,
    dependencies: ["ai", "analytics"],
    requiredPermissions: ["ai:use"],
    configurationDefinitions: ["human-review-required"],
  },
  {
    key: "memberships",
    label: "Memberships",
    moduleClass: "operations",
    businessPurpose: "Own recurring membership contracts and membership lifecycle while Commerce owns payment state.",
    ownedDomains: ["membership-contract", "membership-lifecycle"],
    consumesDomains: ["payments"],
    supportedVerticals: ["salon", "spa", "fitness", "retail"],
    dependencies: ["commerce"],
  },
  {
    key: "inventory",
    label: "Inventory & purchasing",
    moduleClass: "operations",
    businessPurpose: "Own stock, stock movement, purchasing and replenishment state.",
    ownedDomains: ["inventory", "stock-movement", "purchasing"],
    supportedVerticals: ["salon", "spa", "plastic-surgery", "retail"],
  },
  {
    key: "loyalty",
    label: "Loyalty",
    moduleClass: "operations",
    businessPurpose: "Own loyalty earning, redemption and balance state while Commerce owns transaction state.",
    ownedDomains: ["loyalty-ledger", "loyalty-redemption"],
    consumesDomains: ["orders"],
    supportedVerticals: ["salon", "spa", "fitness", "retail"],
    dependencies: ["commerce"],
  },
  {
    key: "ai-receptionist",
    label: "AI Receptionist",
    moduleClass: "ai-assistant",
    businessPurpose: "Assist front-desk/customer interactions using governed communications and appointment tools.",
    ownedDomains: ["reception-assistance"],
    consumesDomains: ["booking", "availability", "message-delivery"],
    supportedVerticals: SERVICE_VERTICALS,
    dependencies: ["ai", "communications", "appointments"],
    requiredPermissions: ["ai:use"],
  },
  {
    key: "ai-retention",
    label: "AI Retention Manager",
    moduleClass: "ai-assistant",
    businessPurpose: "Recommend retention audiences, channels and next actions; CRM remains customer authority and Marketing remains campaign authority.",
    ownedDomains: ["retention-advice"],
    consumesDomains: ["customer-lifecycle", "customer-segmentation", "business-intelligence"],
    decisionSupportOnly: true,
    supportedVerticals: ["salon", "spa", "fitness", "retail"],
    dependencies: ["ai", "crm", "analytics"],
    requiredPermissions: ["ai:use", "retention-automation:manage"],
  },
  {
    key: "ai-stylist-copilot",
    label: "AI Stylist Copilot",
    moduleClass: "ai-assistant",
    businessPurpose: "Assist salon professionals with appointment, consultation, history, service, product and aftercare context while the professional remains decision owner.",
    ownedDomains: ["stylist-decision-support"],
    consumesDomains: ["booking", "service-catalogue", "customer-360"],
    decisionSupportOnly: true,
    supportedVerticals: ["salon"],
    dependencies: ["ai", "appointments", "services"],
    requiredPermissions: ["ai:use"],
  },
  {
    key: "clinical-records",
    label: "Clinical records",
    moduleClass: "specialist",
    businessPurpose: "Own regulated clinical record state for supported clinical verticals.",
    ownedDomains: ["clinical-record"],
    supportedVerticals: ["plastic-surgery"],
    status: "experimental",
  },
].forEach(registerCapabilityPack);
