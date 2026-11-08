/**
 * Read-only declaration inventory from the existing canonical capability
 * registry. A declared integration is NOT a verified, callable API route,
 * a functioning AI tool, or evidence of a configured external provider.
 */
const freeze = (items) => Object.freeze([...items]);
export function inspectModuleContractDeclarations(capabilityDefinitions = [], aiOpportunity = "") {
  if (!Array.isArray(capabilityDefinitions)) {
    throw new TypeError("Canonical capability definitions must be an array.");
  }
  const unique = (field) => freeze([...new Set(capabilityDefinitions.flatMap((definition) =>
    Array.isArray(definition[field]) ? definition[field] : []))].sort());
  const registeredCapabilities = freeze(capabilityDefinitions.map((definition) => definition.key));
  const integrationContracts = unique("integrationContracts");
  const configurationDefinitions = unique("configurationDefinitions");
  const requiredPermissions = unique("requiredPermissions");
  return Object.freeze({
    source: "canonical_capability_registry_declarations",
    registeredCapabilities,
    integrationContracts,
    configurationDefinitions,
    requiredPermissions,
    declaredIntegrationCount: integrationContracts.length,
    declarationState: capabilityDefinitions.length === 0 ? "capability_mapping_missing"
      : integrationContracts.length ? "integration_contracts_declared" : "integration_contracts_not_declared",
    apiRouteVerification: "not_verified",
    apiOperationalAcceptance: "not_verified",
    aiOpportunitySpecified: Boolean(String(aiOpportunity || "").trim()),
    aiToolContractVerification: "not_verified",
    externalProviderReadiness: "not_verified",
    activationAuthorised: false,
  });
}
