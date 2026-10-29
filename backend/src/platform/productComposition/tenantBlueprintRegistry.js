import { getVerticalPackDefinition } from "../capabilities/verticalPackRegistry.js";
import { resolveModuleInstallationPlan } from "../capabilities/moduleInstallationResolver.js";

const tenantBlueprints = new Map();

function clean(value) {
  return String(value || "").trim();
}

function normaliseBlueprint(definition = {}) {
  const key = clean(definition.key).toLowerCase();
  const name = clean(definition.name);
  const verticalId = clean(definition.verticalId).toLowerCase();
  const status = clean(definition.status || "planned").toLowerCase();
  const selectedModuleKeys = Object.freeze([
    ...new Set((definition.selectedModuleKeys || []).map((value) => clean(value).toLowerCase()).filter(Boolean)),
  ]);

  if (!/^[a-z][a-z0-9-]{1,59}$/.test(key)) {
    throw new TypeError("Tenant blueprint key must be 2-60 lowercase letters, numbers or hyphens.");
  }
  if (!name) throw new TypeError("Tenant blueprint name is required.");
  if (!['planned', 'provisioning', 'active', 'suspended'].includes(status)) {
    throw new TypeError("Tenant blueprint status is invalid.");
  }

  const vertical = getVerticalPackDefinition(verticalId);
  const plan = resolveModuleInstallationPlan({ selectedModuleKeys, verticalId });

  return Object.freeze({
    key,
    name,
    verticalId: vertical.id,
    verticalLabel: vertical.label,
    status,
    selectedModuleKeys,
    requiredCapabilityKeys: plan.requiredCapabilityKeys,
    configurationProfile: clean(definition.configurationProfile),
    themeProfile: clean(definition.themeProfile),
    aiProfile: Object.freeze({
      generalTraining: true,
      verticalTraining: true,
      tenantTraining: true,
      continuousMachineLearning: true,
      knowledgeRetrieval: true,
      notes: clean(definition.aiProfile?.notes),
    }),
  });
}

export function registerTenantBlueprint(definition) {
  const blueprint = normaliseBlueprint(definition);
  if (tenantBlueprints.has(blueprint.key)) {
    throw new Error(`Tenant blueprint "${blueprint.key}" is already registered.`);
  }
  tenantBlueprints.set(blueprint.key, blueprint);
  return blueprint;
}

export function getTenantBlueprint(key) {
  return tenantBlueprints.get(clean(key).toLowerCase()) || null;
}

export function listTenantBlueprints() {
  return [...tenantBlueprints.values()];
}

registerTenantBlueprint({
  key: "stylish",
  name: "Stylish",
  verticalId: "salon",
  status: "planned",
  configurationProfile: "salon-tenant-standard",
  themeProfile: "stylish",
  selectedModuleKeys: [
    "appointments",
    "staff",
    "services",
    "commerce",
    "ecommerce-store",
    "inventory",
    "communications",
    "calendar",
    "crm",
    "customer-experience",
    "marketing",
    "analytics",
    "business-planning",
    "ai-decision-support",
    "ai-receptionist",
    "ai-retention",
    "ai-stylist-copilot",
  ],
  aiProfile: {
    notes: "Salon vertical training plus Stylish-specific services, policies, staff, products, customer journeys and governed business-generated ML evidence.",
  },
});

registerTenantBlueprint({
  key: "gut-instinct",
  name: "Gut Instinct",
  verticalId: "retail",
  status: "planned",
  configurationProfile: "retail-tenant-standard",
  themeProfile: "gut-instinct",
  selectedModuleKeys: [
    "commerce",
    "ecommerce-store",
    "inventory",
    "memberships",
    "loyalty",
    "communications",
    "integrations",
    "crm",
    "customer-experience",
    "marketing",
    "seller-marketplace",
    "analytics",
    "business-planning",
    "ai-decision-support",
    "ai-retention",
  ],
  aiProfile: {
    notes: "Retail vertical training plus Gut Instinct product, order, returns, marketplace, marketing and customer-support knowledge. Retail concierge tooling will be enabled only after its non-booking tool profile is governed separately from the salon AI Receptionist contract.",
  },
});

export default listTenantBlueprints;
