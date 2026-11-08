import { getCapabilityPack, listCapabilityPacks } from "../capabilities/capabilityRegistry.js";

/**
 * AIIBP v3 module catalogue: requirements and taxonomy, NOT a second
 * deployable capability registry. Planning status is never runtime evidence.
 */
export const MODULE_CATEGORIES = Object.freeze([
  "Core Platform and SaaS Infrastructure",
  "AI Intelligence, Agents and Automation",
  "Business Operations and Administration",
  "Customer Relationship Management and Engagement",
  "Workforce and Human Resources",
  "Communications and Omnichannel Services",
  "Marketing, Advertising, SEO and Social Media",
  "E-commerce, Payments, Sales and Marketplaces",
  "Analytics, Reporting and Business Intelligence",
  "Finance, Accounting and Commercial Management",
  "Inventory, Procurement and Supply Chain",
  "Security, Compliance and Governance",
  "Integration and Developer Platform Services",
  "Industry-Specific Modules",
  "Future Innovation and Advanced AI Modules",
]);

// This list preserves all 27 requirement identifiers in 03_module_catalogue.md.
// Capability keys below reference existing canonical registrations; empty
// mappings are unresolved planning items, not missing permissions.
const REQUIREMENTS = [
  ["01", "Appointments & Booking", 2, "Business Operations", "Source in progress", "P1", ["appointments"], "Booking concierge, no-show forecasts"],
  ["02", "Workforce & Staff", 4, "Workforce", "Source in progress", "P1", ["staff"], "Roster recommendations, workforce prediction"],
  ["03", "Service Catalogue", 2, "Business Operations", "Source in progress", "P1", ["services"], "Service descriptions, service matching"],
  ["04", "Commerce", 7, "E-commerce & Sales", "Source in progress", "P1", ["commerce"], "Order exceptions, cross-sell insights"],
  ["05", "E-commerce & Online Store", 7, "E-commerce & Sales", "Source in progress", "P1", [], "Product recommendations, merchandising"],
  ["06", "Memberships", 3, "CRM & Engagement", "Source in progress", "P1", ["memberships"], "Churn risk, recovery advisory"],
  ["07", "Inventory & Purchasing", 10, "Supply Chain", "Source in progress", "P1", ["inventory"], "Stockout forecast, procurement suggestions"],
  ["08", "Loyalty", 3, "CRM & Engagement", "Source in progress", "P1", ["loyalty"], "Reward relevance, retention segments"],
  ["09", "Communications", 5, "Omnichannel", "Source in progress", "P1", ["communications"], "Assisted replies, channel routing"],
  ["10", "Calendar Integration", 2, "Business Operations", "Source in progress", "P1", ["calendar"], "Availability insights; human confirmed changes"],
  ["11", "Integration Hub", 12, "Core & Developer Platform", "Source observed", "P0", [], "AI tool adapters, provider health insights"],
  ["12", "CRM & Customer Intelligence", 3, "CRM & Engagement", "Source in progress", "P1", [], "Customer 360, churn, next best action"],
  ["13", "Customer Experience", 3, "CRM & Engagement", "Source in progress", "P1", [], "Content assistance, sentiment, FAQs"],
  ["14", "Marketing, Advertising & SEO", 6, "Marketing & Social", "Source observed; PR #586 active (roadmap snapshot)", "P1", [], "AI SEO, social media, content, campaign advisory"],
  ["15", "Seller & Marketplace Management", 7, "E-commerce & Sales", "Source in progress", "P2", [], "Listing/feed intelligence, marketplace analytics"],
  ["16", "Analytics & Business Intelligence", 8, "Analytics & BI", "Source observed", "P0", ["analytics"], "Evidence-grounded management copilot"],
  ["17", "Business Planning & Forecasting", 8, "Analytics & BI", "Source in progress", "P2", [], "Scenario projections and forecasts"],
  ["18", "AI Business Adviser", 1, "AI Applications", "Deterministic advisory source observed", "P0", ["ai"], "Governed multi-module assistant"],
  ["19", "AI Receptionist", 1, "AI Applications", "Needs acceptance audit", "P1", ["ai-receptionist"], "Booking/support agent via governed APIs"],
  ["20", "AI Retention Manager", 1, "AI Applications", "Needs acceptance audit", "P1", ["ai-retention"], "Retention agent and next-best-action planning"],
  ["21", "AI Stylist Copilot", 1, "AI Applications", "Prior roadmap says source complete", "P2", [], "Contextual service/staff suggestions"],
  ["22", "Future AI selection slot", 14, "Not a deployable module", "Research placeholder", "P3", [], "Select only after feasibility evaluation"],
  ["23", "Clinical Records", 13, "Vertical-specific", "Restricted / deferred", "P3", ["clinical-records"], "Clinical summarisation with strict human control"],
  ["24", "Finance & Accounting Integrations", 9, "Finance", "Proposed", "P2", [], "Reconciliation anomaly detection"],
  ["25", "Fulfilment & Delivery", 10, "Supply Chain", "Proposed", "P2", [], "Fulfilment exception forecasting"],
  ["26", "Services / Products / Stock split", 14, "Taxonomy refactor", "Not a separate module", "P1", [], "Preserve existing canonical services and inventories"],
  ["27", "Data Management & Audit Centre", 11, "Core Governance", "Proposed", "P2", [], "Data quality and audit anomaly detection"],
];

const CANDIDATES = [
  ["CORE-01", "Tenant Identity & Provisioning", 0, "Existing source; activation unknown", "P0", []],
  ["CORE-02", "Module Registry/Composition & Entitlements", 0, "Partially verified", "P0", []],
  ["CORE-03", "API Gateway & Integration Registry", 12, "Existing contracts", "P0", []],
  ["CORE-04", "Secrets, Events, Audit & Policy", 11, "Existing fragments; reconcile", "P0", []],
  ["AI-CORE-01", "AI Orchestration & Policy Engine", 1, "Proposed expansion", "P0", ["ai"]],
  ["AI-CORE-02", "Agent Registry, Tools & Evaluations", 1, "Existing registry elements; extension needed", "P0", ["ai"]],
  ["AI-CORE-03", "Tenant Knowledge / RAG", 1, "Proposed; status unverified", "P1", []],
  ["AI-CORE-04", "Model Gateway, Cost & Safety", 1, "Proposed extension", "P0", []],
  ["AI-CORE-05", "Human Approval & Execution Ledger", 1, "Proposed extension", "P0", []],
  ["MKT-01", "Social Media Management", 6, "Dedicated expanded capability; source partial", "P1", []],
  ["MKT-02", "Content Calendar and Asset Library", 6, "Proposed integration", "P1", []],
  ["MKT-03", "Social Community/Inbox", 6, "Proposed; API-dependent", "P2", []],
  ["MKT-04", "Social Listening & Reputation", 6, "Proposed; API-dependent", "P2", []],
  ["MKT-05", "Cross-Channel Campaign Studio", 6, "Partial campaign source", "P2", []],
  ["MKT-06", "Backlinks/Editorial Outreach", 6, "PR #586 unmerged (roadmap snapshot; independently verify)", "P1", []],
  ["MKT-07", "AI Search Visibility", 6, "Proposed", "P2", []],
  ["FIN-01", "Accounting Connectors / Reconciliation", 9, "Proposed", "P2", []],
  ["DATA-01", "Import, Export, Mapping & Audit Centre", 11, "Proposed extension", "P2", []],
  ["FUL-01", "Delivery/Returns/Carrier Integrations", 10, "Proposed", "P2", []],
  ["VERT-01", "Salon AI tenant vertical pack", 13, "Future tenant; not AIIBP brand", "P2", []],
  ["VERT-02", "Gut Instinct tenant vertical pack", 13, "Future tenant; domain requirements TBD", "P3", []],
];

const freezeArray = (value) => Object.freeze([...value]);
function resolveCapabilityMetadata(keys) {
  const packs = keys.map((key) => getCapabilityPack(key));
  return {
    permissions: freezeArray([...new Set(packs.flatMap((pack) => pack.requiredPermissions))]),
    dependencies: freezeArray([...new Set(packs.flatMap((pack) => pack.dependencies))]),
    verticalCompatibility: packs.length === 1 ? freezeArray(packs[0].supportedVerticals) : freezeArray([]),
  };
}

function catalogueRecord({ id, name, categoryIndex, sourceClass, status, priority, keys, aiOpportunity = "", kind }) {
  const metadata = resolveCapabilityMetadata(keys);
  return Object.freeze({
    moduleId: id,
    displayName: name,
    category: MODULE_CATEGORIES[categoryIndex],
    sourceClass,
    sourceStatus: status,
    priority,
    kind,
    owner: "DEV1",
    lifecycle: kind === "placeholder" ? "research" : "planning",
    version: null, // Source/binary release version requires independent evidence.
    deploymentStatus: "unknown",
    productionAcceptance: "unknown",
    dependencies: metadata.dependencies,
    entitlementKey: keys.length === 1 ? keys[0] : null,
    capabilityPackKeys: freezeArray(keys),
    scopeClass: "unverified",
    permissions: metadata.permissions,
    apiCapabilities: freezeArray([]),
    aiToolRefs: freezeArray([]),
    verticalCompatibility: metadata.verticalCompatibility,
    providerReadiness: "unknown",
    evidenceLinks: freezeArray([]),
    lastReviewedAt: null,
    aiOpportunity,
    taxonomyOnly: id === "22" || id === "26",
  });
}

export const CANONICAL_MODULE_REQUIREMENTS = Object.freeze(REQUIREMENTS.map(
  ([id, name, categoryIndex, sourceClass, status, priority, keys, aiOpportunity]) =>
    catalogueRecord({ id, name, categoryIndex, sourceClass, status, priority, keys,
      aiOpportunity, kind: id === "22" ? "placeholder" : "requirement" }),
));

export const MODULE_CANDIDATES = Object.freeze(CANDIDATES.map(
  ([id, name, categoryIndex, status, priority, keys]) => catalogueRecord({
    id, name, categoryIndex, sourceClass: "Candidate capability", status,
    priority, keys, kind: "candidate",
  }),
));

export function listModuleCatalogue({ includeCandidates = false, category = null, priority = null } = {}) {
  if (category !== null && !MODULE_CATEGORIES.includes(category)) {
    throw new TypeError("Unknown canonical catalogue category.");
  }
  if (priority !== null && !["P0", "P1", "P2", "P3"].includes(priority)) {
    throw new TypeError("Unknown catalogue priority.");
  }
  const rows = includeCandidates
    ? [...CANONICAL_MODULE_REQUIREMENTS, ...MODULE_CANDIDATES]
    : CANONICAL_MODULE_REQUIREMENTS;
  return rows.filter((row) => (category === null || row.category === category) &&
    (priority === null || row.priority === priority));
}

export function getModuleCatalogueEntry(moduleId) {
  const id = String(moduleId || "").trim();
  const entry = [...CANONICAL_MODULE_REQUIREMENTS, ...MODULE_CANDIDATES]
    .find((row) => row.moduleId === id);
  if (!entry) {
    const error = new Error("Unknown module catalogue requirement or candidate.");
    error.code = "UNKNOWN_MODULE_CATALOGUE_ID";
    throw error;
  }
  return entry;
}

/**
 * A catalogue entry is not an entitlement. Enriched status is only
 * observed evidence and never makes an activation decision.
 */
export function inspectModuleCatalogueStatus(moduleId, {
  composition = null,
  configured = null,
  providerVerified = null,
  ingestionActive = null,
  productionAccepted = null,
} = {}) {
  const entry = getModuleCatalogueEntry(moduleId);
  const key = entry.entitlementKey;
  const capability = key && composition?.capabilities?.find((c) => c.key === key);
  const supported = key ? listCapabilityPacks().some((p) => p.key === key) : false;
  const entitled = capability ? (capability.reason === "not-entitled" ? false :
    capability.enabled === true ? true : null) : null;
  return Object.freeze({
    moduleId,
    catalogueVisible: true,
    canonicalCapabilityRegistered: supported,
    entitled,
    configured: typeof configured === "boolean" ? configured : null,
    providerVerified: typeof providerVerified === "boolean" ? providerVerified : null,
    ingestionActive: typeof ingestionActive === "boolean" ? ingestionActive : null,
    productionAccepted: typeof productionAccepted === "boolean" ? productionAccepted : null,
    deploymentStatus: entry.deploymentStatus,
    activationAuthorised: false,
    evidenceNeeded: true,
  });
}

export function validateModuleCatalogueIntegrity() {
  const all = [...CANONICAL_MODULE_REQUIREMENTS, ...MODULE_CANDIDATES];
  const ids = all.map((row) => row.moduleId);
  if (CANONICAL_MODULE_REQUIREMENTS.length !== 27 ||
      MODULE_CATEGORIES.length !== 15 || MODULE_CANDIDATES.length !== 21 ||
      new Set(ids).size !== ids.length ||
      CANONICAL_MODULE_REQUIREMENTS.some((row, i) => row.moduleId !== String(i + 1).padStart(2, "0")) ||
      all.some((row) => !MODULE_CATEGORIES.includes(row.category) ||
        row.capabilityPackKeys.some((key) => !listCapabilityPacks().some((pack) => pack.key === key)))) {
    throw new Error("Module catalogue taxonomy or canonical capability mappings are inconsistent.");
  }
  return Object.freeze({
    valid: true, requirementCount: CANONICAL_MODULE_REQUIREMENTS.length,
    candidateCount: MODULE_CANDIDATES.length, categoryCount: MODULE_CATEGORIES.length,
  });
}
