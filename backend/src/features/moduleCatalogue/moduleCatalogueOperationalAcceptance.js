import {
  listModuleCatalogue,
} from "../../platform/moduleCatalogue/canonicalModuleCatalogue.js";
import { getCapabilityPack } from "../../platform/capabilities/capabilityRegistry.js";
import { inspectTrustedTenantModuleEvidence } from "./moduleCatalogueTenantRuntimeEvidence.js";

const UNKNOWN = "not_verified";
const PASSED = "evidence_present";
const FAILED = "failed_or_missing";

function criterion(key, status, description) {
  return Object.freeze({ key, status, description });
}
/**
 * Read-only assessment of tenant-level prerequisites for module acceptance.
 * It neither authorises a capability nor creates a production sign-off.
 * Tenant and subscription evidence comes exclusively from the existing
 * server-side trusted authority inspector (which enforces all-location RBAC).
 */
export async function inspectModuleOperationalAcceptance({
  effectiveAuthority,
} = {}, {
  tenantInspector = inspectTrustedTenantModuleEvidence,
} = {}) {
  // Do not swallow failures here: an unauthorised caller must receive 403,
  // not a public catalogue or tenant status.
  const trusted = await tenantInspector({ effectiveAuthority });
  const tenantRows = new Map((trusted.entries || []).map((row) => [row.moduleId, row]));
  const entries = listModuleCatalogue({ includeCandidates: true }).map((item) => {
    const mapped = item.capabilityPackKeys.length > 0 && !item.taxonomyOnly;
    const tenant = tenantRows.get(item.moduleId);
    const definitions = mapped ? item.capabilityPackKeys.map(getCapabilityPack) : [];
    const prerequisiteKeys = [...new Set(definitions.flatMap((def) => def.dependencies))];
    const requiredPermissions = [...new Set(definitions.flatMap((def) => def.requiredPermissions))];

    const checks = [
      criterion("canonical_capability_mapping", mapped ? PASSED : UNKNOWN,
        mapped ? "Canonical capability pack mapping recorded" :
          "Capability mapping requires separate implementation review"),
      criterion("trusted_tenant_records",
        trusted.integrity === "verified_manifest_and_subscription" ? PASSED : UNKNOWN,
        "Manifest and subscription evidence verified"),
      criterion("manifest_composition", tenant?.manifestSelected === true ? PASSED :
        tenant?.manifestSelected === false ? FAILED : UNKNOWN,
        "Capability present in trusted tenant product composition"),
      criterion("subscription_entitlement", tenant?.subscriptionEntitled === true ? PASSED :
        tenant?.subscriptionEntitled === false ? FAILED : UNKNOWN,
        "Subscription entitlement granted"),
      criterion("subscription_lifecycle", tenant?.subscriptionStatus === "active" ||
        tenant?.subscriptionStatus === "trial" ? PASSED :
        tenant?.subscriptionStatus ? FAILED : UNKNOWN,
        "Subscription has eligible lifecycle status"),
      criterion("dependency_acceptance", UNKNOWN,
        "Dependency activation and cross-module behaviour independently tested"),
      criterion("effective_permission_tests", UNKNOWN,
        "Positive and negative role/permission tests for the tenant"),
      criterion("tenant_location_isolation", UNKNOWN,
        "Database-backed cross-tenant and cross-location acceptance tests"),
      criterion("module_api_acceptance", UNKNOWN,
        "Module API and workflow acceptance tests"),
      criterion("provider_readiness", UNKNOWN,
        "External provider integration independently verified when applicable"),
      criterion("deployment_runtime", UNKNOWN,
        "Current signed deployment identity and live module readiness"),
      criterion("production_signoff", UNKNOWN,
        "Separately authorised production acceptance"),
    ];

    const blocking = checks.filter((check) => check.status === FAILED).map((check) => check.key);
    const awaitingEvidence = checks.filter((check) => check.status === UNKNOWN).map((check) => check.key);
    return Object.freeze({
      moduleId: item.moduleId,
      displayName: item.displayName,
      category: item.category,
      mappedCapabilityPackKeys: Object.freeze([...item.capabilityPackKeys]),
      expectedDependencies: Object.freeze(prerequisiteKeys),
      requiredPermissionDefinitions: Object.freeze(requiredPermissions),
      checks: Object.freeze(checks),
      confirmedBlockers: Object.freeze(blocking),
      outstandingVerification: Object.freeze(awaitingEvidence),
      readyForProductionAcceptance: false,
      productionAccepted: null,
      activationAuthorised: false,
    });
  });
  return Object.freeze({
    businessId: trusted.businessId,
    source: "trusted_tenant_composition_plus_acceptance_checklist",
    readOnly: true,
    manifestIntegrity: trusted.integrity,
    assessmentCount: entries.length,
    acceptedCount: 0,
    assessmentNotApproval: true,
    entries: Object.freeze(entries),
  });
}
