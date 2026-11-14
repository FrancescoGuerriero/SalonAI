/**
 * Deterministic, read-only acceptance contract for each catalogue entry.
 * These are evidence requirements, NOT assertions that routes or AI tools exist.
 * The authoritative feature/permission/tenant checks stay in their services.
 */
const frozen = (values) => Object.freeze([...values]);

export function buildModuleAcceptanceContract(entry, {
  expectedDependencies = [],
  requiredPermissionDefinitions = [],
  contractEvidence = null,
} = {}) {
  if (!entry || typeof entry.moduleId !== "string" || !entry.moduleId.trim()) {
    throw new TypeError("A canonical module catalogue entry is required.");
  }
  const capabilityPackKeys = frozen(entry.capabilityPackKeys || []);
  const taxonomyOnly = entry.taxonomyOnly === true;
  const mapped = capabilityPackKeys.length > 0 && !taxonomyOnly;
  const permissions = frozen([...new Set(requiredPermissionDefinitions)]);
  const dependencies = frozen([...new Set(expectedDependencies)]);
  const declaredIntegrations = frozen(contractEvidence?.integrationContracts || []);
  const hasAiOpportunity = Boolean(String(entry.aiOpportunity || "").trim());

  // No route/path/HTTP verb is inferred from a requirement name. Implementers
  // must supply independent route inventory and authenticated API evidence.
  const verificationItems = frozen([
    "authenticated_api_route_inventory",
    "positive_and_negative_permission_tests",
    "foreign_business_access_denied",
    "unauthorised_location_access_denied",
    "dependency_workflow_tests",
    "tenant_subscription_and_feature_gates",
    ...(hasAiOpportunity ? [
      "ai_tool_registry_binding",
      "ai_tool_tenant_and_permission_enforcement",
      "ai_tool_human_approval_and_audit_if_applicable",
      "ai_tool_failure_and_prompt_injection_tests",
    ] : []),
    ...(declaredIntegrations.length ? [
      "integration_contract_compatibility_tests",
      "provider_credentials_and_callback_validation",
    ] : []),
    "deployed_runtime_identity",
    "production_acceptance_signoff",
  ]);

  return Object.freeze({
    moduleId: entry.moduleId,
    contractType: taxonomyOnly ? "taxonomy_only"
      : mapped ? "mapped_capability_acceptance" : "unmapped_planning_review",
    capabilityPackKeys,
    requiredPermissionDefinitions: permissions,
    expectedDependencies: dependencies,
    declaredIntegrationContracts: declaredIntegrations,
    aiOpportunitySpecified: hasAiOpportunity,
    routeInventoryVerified: false,
    aiToolRegistryBindingVerified: false,
    // These checks are independently executed and supplied elsewhere.
    verificationItems,
    acceptanceEvidenceStatus: "not_verified",
    productionAccepted: null,
    activationAuthorised: false,
  });
}
