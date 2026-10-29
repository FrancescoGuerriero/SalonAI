import { AIIBP_COMMERCIAL_MODULES } from "./aiibpCommercialModules.js";

export const AIIBP_MODULE_CLASSES = Object.freeze({
  CORE: "core",
  SYSTEM: "system",
  COMMERCIAL: "commercial",
});

function moduleDefinition(definition) {
  return Object.freeze(definition);
}

export const AIIBP_CORE_PLATFORM_MODULES = Object.freeze([
  moduleDefinition({ key: "tenant-business-core", label: "Tenant & Business Core", moduleClass: "core", summary: "Business ownership, tenant isolation and canonical tenant identity." }),
  moduleDefinition({ key: "location-core", label: "Location Core", moduleClass: "core", summary: "Locations, branches and location-scoped ownership used across AIIBP." }),
  moduleDefinition({ key: "identity-authentication", label: "Identity & Authentication", moduleClass: "core", summary: "Customer and workforce identity, authentication and secure account boundaries." }),
  moduleDefinition({ key: "rbac-authority", label: "RBAC & Effective Authority", moduleClass: "core", summary: "Roles, permissions and effective Business/Location authority enforcement." }),
  moduleDefinition({ key: "entitlements-composition", label: "Entitlements & Product Composition", moduleClass: "core", summary: "Controls which commercial modules and capability packs a tenant is entitled to use." }),
  moduleDefinition({ key: "configuration-core", label: "Configuration Core", moduleClass: "core", summary: "Tenant, vertical, terminology and product configuration without code forks." }),
  moduleDefinition({ key: "audit-governance", label: "Audit & Governance", moduleClass: "core", summary: "Auditable provenance for privileged operations, provider activity and governed automation." }),
  moduleDefinition({ key: "privacy-consent", label: "Privacy & Consent Core", moduleClass: "core", summary: "Consent, communication preferences, privacy controls and data-rights boundaries." }),
  moduleDefinition({ key: "api-webhook-core", label: "API & Webhook Core", moduleClass: "core", summary: "Shared provider-neutral external API and webhook contracts." }),
  moduleDefinition({ key: "ai", label: "AI Core", moduleClass: "core", link: "/admin/system/ai-core", summary: "General, vertical and tenant AI foundations plus governed datasets, model lifecycle, evaluation, provenance and approved tools." }),
]);

export const AIIBP_SYSTEM_MODULES = Object.freeze([
  moduleDefinition({ key: "provider-connections", label: "Provider Connection Framework", moduleClass: "system", link: "/admin/system/connections", summary: "Reusable OAuth/API credential, account selection, scope, health and disconnect workflow for external providers." }),
  moduleDefinition({ key: "data-hub", label: "Data Hub", moduleClass: "system", link: "/marketing/data-hub", summary: "Provider-neutral raw and normalised data ingestion, lineage, mapping and data-health foundation." }),
  moduleDefinition({ key: "communications-engine", label: "Communications Engine", moduleClass: "system", link: "/communications", summary: "Canonical transactional and marketing delivery engine for email, SMS, WhatsApp and future channels." }),
  moduleDefinition({ key: "campaign-attribution-engine", label: "Campaign & Attribution Engine", moduleClass: "system", link: "/marketing", summary: "Canonical campaign executions, channel performance and deterministic attribution evidence." }),
  moduleDefinition({ key: "marketing-automation-engine", label: "Marketing Automation Engine", moduleClass: "system", link: "/marketing", summary: "Consent-aware triggers, schedules, approvals and journeys that request delivery from Communications." }),
  moduleDefinition({ key: "analytics-engine", label: "Analytics & BI Engine", moduleClass: "system", link: "/reports", summary: "Metric catalogue, deterministic read models and governed cross-module analytics." }),
  moduleDefinition({ key: "ai-governance", label: "AI Governance & Learning", moduleClass: "system", link: "/admin/system/ai-core", summary: "General training, vertical training, tenant-specific training, continuous ML evaluation and human-controlled model promotion." }),
  moduleDefinition({ key: "background-jobs", label: "Jobs & Scheduling", moduleClass: "system", summary: "Tenant-safe scheduled sync, background processing, retries and operational job controls." }),
  moduleDefinition({ key: "import-export", label: "Import & Export", moduleClass: "system", link: "/data-imports", summary: "Governed data import/export, validation, provenance and portability workflows." }),
  moduleDefinition({ key: "observability-health", label: "Observability & Health", moduleClass: "system", summary: "Connection, sync, worker and platform health evidence for operators and administrators." }),
]);

export const AIIBP_COMMERCIAL_BUSINESS_MODULES = Object.freeze(
  AIIBP_COMMERCIAL_MODULES.map((module) =>
    moduleDefinition({
      ...module,
      moduleClass: "commercial",
    })
  )
);

export const AIIBP_MODULE_REGISTRY = Object.freeze([
  ...AIIBP_CORE_PLATFORM_MODULES,
  ...AIIBP_SYSTEM_MODULES,
  ...AIIBP_COMMERCIAL_BUSINESS_MODULES,
]);

export function modulesByClass(moduleClass) {
  return AIIBP_MODULE_REGISTRY.filter((module) => module.moduleClass === moduleClass);
}
