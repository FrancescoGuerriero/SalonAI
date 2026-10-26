import { getCapabilityPack } from "../capabilities/capabilityRegistry.js";

const MODULE_KINDS = Object.freeze([
  "operations",
  "platform-connection",
  "customer-intelligence",
  "automation",
  "analytics",
  "decision-support",
]);

const BUSINESS_MODULES = Object.freeze([
  {
    key: "booking-operations",
    label: "Booking & Operations",
    kind: "operations",
    capabilityPacks: ["appointments", "calendar", "services"],
    primaryResponsibilities: [
      "appointment-lifecycle",
      "availability-and-booking",
      "waitlist-and-reception",
      "service-scheduling",
    ],
    dependsOnModules: [],
    connectsExternalPlatforms: false,
    aiAssisted: false,
    executionAuthority: "canonical",
    boundary: "Owns booking and schedule state. It does not own outbound communications, marketing campaigns, BI or AI recommendations.",
  },
  {
    key: "workforce",
    label: "Workforce & Staff",
    kind: "operations",
    capabilityPacks: ["staff"],
    primaryResponsibilities: [
      "employee-records",
      "staff-roles-and-eligibility",
      "staff-availability",
    ],
    dependsOnModules: [],
    connectsExternalPlatforms: false,
    aiAssisted: false,
    executionAuthority: "canonical",
    boundary: "Owns workforce identity, eligibility and staff availability. It does not own booking, payroll, campaign or AI inference state.",
  },
  {
    key: "commerce",
    label: "Commerce",
    kind: "operations",
    capabilityPacks: ["commerce", "memberships", "loyalty"],
    primaryResponsibilities: [
      "checkout-and-orders",
      "payments-refunds-and-invoices",
      "memberships-and-recurring-value",
      "loyalty-and-stored-value",
    ],
    dependsOnModules: [],
    connectsExternalPlatforms: true,
    aiAssisted: false,
    executionAuthority: "canonical",
    boundary: "Owns financial and value-program state. Marketing may measure revenue but must not mutate commerce authority.",
  },
  {
    key: "inventory-purchasing",
    label: "Inventory & Purchasing",
    kind: "operations",
    capabilityPacks: ["inventory"],
    primaryResponsibilities: [
      "stock-ledger",
      "supplier-management",
      "purchase-ordering",
      "reorder-workflow",
    ],
    dependsOnModules: [],
    connectsExternalPlatforms: true,
    aiAssisted: false,
    executionAuthority: "canonical",
    boundary: "Owns stock and purchasing state. Forecasts may advise but must not silently alter stock or purchase orders.",
  },
  {
    key: "crm-customer-intelligence",
    label: "CRM & Customer Intelligence",
    kind: "customer-intelligence",
    capabilityPacks: ["crm"],
    primaryResponsibilities: [
      "customer-360",
      "customer-lifecycle",
      "customer-segmentation",
      "customer-consent-and-contactability",
      "retention-evidence",
    ],
    dependsOnModules: [],
    connectsExternalPlatforms: false,
    aiAssisted: false,
    executionAuthority: "canonical-read-model",
    boundary: "Owns customer lifecycle, deterministic segments and consent/contactability evidence. It does not send campaigns or own provider credentials.",
  },
  {
    key: "communications",
    label: "Communications",
    kind: "operations",
    capabilityPacks: ["communications"],
    primaryResponsibilities: [
      "message-templates",
      "channel-delivery",
      "delivery-status-and-retry",
      "scheduled-message-delivery",
    ],
    dependsOnModules: [],
    connectsExternalPlatforms: true,
    aiAssisted: false,
    executionAuthority: "canonical",
    boundary: "Owns delivery through email, SMS, WhatsApp and notification channels. It does not decide campaign audiences or business strategy.",
  },
  {
    key: "integration-hub",
    label: "Integration Hub",
    kind: "platform-connection",
    capabilityPacks: ["integrations"],
    primaryResponsibilities: [
      "provider-account-connections",
      "provider-credential-governance",
      "external-data-ingestion",
      "normalised-data-lineage",
      "governed-data-destinations",
    ],
    dependsOnModules: [],
    connectsExternalPlatforms: true,
    aiAssisted: false,
    executionAuthority: "integration-control-plane",
    boundary: "Owns Windsor-style/provider-neutral connections, credentials, ingestion and lineage. It does not own campaigns, CRM lifecycle decisions or BI interpretation.",
  },
  {
    key: "marketing-automation",
    label: "Marketing Automation",
    kind: "automation",
    capabilityPacks: ["marketing-automation"],
    primaryResponsibilities: [
      "campaign-definition-and-orchestration",
      "journey-definition-and-enrolment",
      "audience-activation",
      "campaign-approval-and-scheduling",
      "campaign-attribution-orchestration",
    ],
    dependsOnModules: [
      "crm-customer-intelligence",
      "communications",
      "integration-hub",
      "analytics-bi",
    ],
    connectsExternalPlatforms: false,
    aiAssisted: true,
    executionAuthority: "human-approved-automation",
    boundary: "Consumes CRM audiences, Integration Hub data, Communications delivery and BI evidence. It owns campaign/journey orchestration only; it does not own provider credentials, customer consent, message transport or AI model authority.",
  },
  {
    key: "analytics-bi",
    label: "Analytics & BI",
    kind: "analytics",
    capabilityPacks: ["analytics"],
    primaryResponsibilities: [
      "business-metrics",
      "reporting-and-dashboards",
      "campaign-performance-reporting",
      "revenue-and-operational-analysis",
    ],
    dependsOnModules: ["integration-hub"],
    connectsExternalPlatforms: false,
    aiAssisted: false,
    executionAuthority: "read-only-evidence",
    boundary: "Owns deterministic reporting and evidence. It must not execute campaigns, mutate operational records or present AI inference as canonical fact.",
  },
  {
    key: "ai-decision-support",
    label: "AI Decision Support",
    kind: "decision-support",
    capabilityPacks: ["ai", "ai-decision-support"],
    primaryResponsibilities: [
      "management-copilot",
      "professional-copilot",
      "predictive-risk-and-opportunity",
      "recommendation-and-next-best-action",
      "natural-language-business-analysis",
    ],
    dependsOnModules: ["analytics-bi"],
    connectsExternalPlatforms: false,
    aiAssisted: true,
    executionAuthority: "advisory-only",
    boundary: "Produces explainable recommendations and predictions for human review. It does not directly write canonical business data, send marketing, charge customers or override safety/consent rules.",
  },
  {
    key: "ai-receptionist",
    label: "AI Receptionist",
    kind: "automation",
    capabilityPacks: ["ai", "ai-receptionist"],
    primaryResponsibilities: [
      "customer-conversation-orchestration",
      "front-desk-intent-handling",
      "governed-booking-tool-use",
    ],
    dependsOnModules: ["booking-operations", "communications"],
    connectsExternalPlatforms: false,
    aiAssisted: true,
    executionAuthority: "governed-tool-execution",
    boundary: "Handles customer-facing conversational front-desk workflows using authorised tools. It is separate from internal AI decision support and from marketing automation.",
  },
]);

const byKey = new Map(BUSINESS_MODULES.map((module) => [module.key, module]));

export function getBusinessModule(moduleKey) {
  const module = byKey.get(String(moduleKey || "").trim().toLowerCase());
  if (!module) {
    const error = new Error(`Business module "${moduleKey}" is not registered.`);
    error.statusCode = 400;
    error.code = "UNKNOWN_BUSINESS_MODULE";
    throw error;
  }
  return module;
}

export function listBusinessModules() {
  return [...BUSINESS_MODULES];
}

export function validateBusinessModuleRegistry() {
  const responsibilityOwner = new Map();

  for (const module of BUSINESS_MODULES) {
    if (!MODULE_KINDS.includes(module.kind)) {
      throw new Error(`Business module "${module.key}" has unsupported kind "${module.kind}".`);
    }

    for (const capabilityKey of module.capabilityPacks) {
      getCapabilityPack(capabilityKey);
    }

    for (const dependency of module.dependsOnModules) {
      if (!byKey.has(dependency)) {
        throw new Error(`Business module "${module.key}" depends on unknown module "${dependency}".`);
      }
      if (dependency === module.key) {
        throw new Error(`Business module "${module.key}" cannot depend on itself.`);
      }
    }

    for (const responsibility of module.primaryResponsibilities) {
      const existingOwner = responsibilityOwner.get(responsibility);
      if (existingOwner) {
        throw new Error(
          `Primary responsibility "${responsibility}" is duplicated by "${existingOwner}" and "${module.key}".`
        );
      }
      responsibilityOwner.set(responsibility, module.key);
    }
  }

  return Object.freeze({
    valid: true,
    moduleCount: BUSINESS_MODULES.length,
    primaryResponsibilityCount: responsibilityOwner.size,
  });
}

export function resolveBusinessModuleAllocation(entitledCapabilityPackKeys = []) {
  const entitled = new Set(entitledCapabilityPackKeys);
  return BUSINESS_MODULES.map((module) => ({
    ...module,
    allocated: module.capabilityPacks.every((key) => entitled.has(key)),
    missingCapabilityPacks: module.capabilityPacks.filter((key) => !entitled.has(key)),
  }));
}

validateBusinessModuleRegistry();

export default BUSINESS_MODULES;
