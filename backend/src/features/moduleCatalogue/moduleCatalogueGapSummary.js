import { getModuleCatalogueEntry } from "../../platform/moduleCatalogue/canonicalModuleCatalogue.js";

const PRIORITY_ORDER = Object.freeze(["P0", "P1", "P2", "P3"]);

/**
 * Read-only summary of the verified operational-acceptance checklist.
 * A missing test is "not verified", never "failed" or "production ready".
 * This planning projection MUST NOT be used to grant module access.
 */
export function summariseModuleOperationalGaps(assessments = []) {
  if (!Array.isArray(assessments)) {
    throw new TypeError("Module operational assessments must be an array.");
  }
  const ids = new Set();
  const rows = assessments.map((item) => {
    const definition = getModuleCatalogueEntry(item.moduleId);
    if (ids.has(definition.moduleId)) {
      throw new Error("Duplicate module catalogue assessment ID.");
    }
    ids.add(definition.moduleId);
    const checks = Array.isArray(item.checks) ? item.checks : [];
    const blocked = checks.filter((check) => check.status === "failed_or_missing")
      .map((check) => check.key);
    const unverified = checks.filter((check) => check.status === "not_verified")
      .map((check) => check.key);
    const mapped = definition.capabilityPackKeys.length > 0 && !definition.taxonomyOnly;
    // Mapping status is a planning observation, never proof of a deployable module.
    const mappingReviewState = definition.taxonomyOnly ? "taxonomy_only"
      : mapped ? "canonical_mapping_recorded" : "mapping_review_required";
    const aiEvidenceState = definition.aiOpportunity
      ? "tool_contract_not_verified" : "ai_integration_not_specified";
    const dependencyEvidence = Array.isArray(item.dependencyEvidence) ? item.dependencyEvidence : [];
    const contractEvidence = item.contractEvidence || null;
    const implementationReference = item.implementationReference || null;
    const implementationReviewState = implementationReference?.existingImplementationReview === true
      ? "existing_source_reviewed" : "source_not_reviewed";
    return Object.freeze({
      moduleId: definition.moduleId,
      displayName: definition.displayName,
      category: definition.category,
      priority: definition.priority,
      kind: definition.kind,
      aiOpportunity: definition.aiOpportunity,
      aiEvidenceState,
      mappingReviewState,
      implementationReviewState,
      implementationRouteCount: implementationReference?.apiMounts?.length || 0,
      suggestedNextReview: mappingReviewState === "mapping_review_required"
        ? "review_capability_mapping"
        : dependencyEvidence.some((dependency) => dependency.state === "confirmed_prerequisite_blocker")
          ? "investigate_tenant_dependency_prerequisites"
          : dependencyEvidence.some((dependency) => dependency.state === "not_verified")
            ? "verify_dependency_prerequisites"
            : blocked.length ? "resolve_confirmed_acceptance_blocker"
              : aiEvidenceState === "tool_contract_not_verified"
                ? "verify_ai_tool_contract_evidence"
                : "complete_operational_acceptance_evidence",
      mappedCapabilityPackKeys: definition.capabilityPackKeys,
      dependencyEvidence: Object.freeze([...dependencyEvidence]),
      contractEvidence,
      integrationDeclarationState: contractEvidence?.declarationState || "not_verified",
      relatedSourceReviewCount: contractEvidence?.relatedSourceReviews?.length || 0,
      dependencyPrerequisiteBlockers: Object.freeze(dependencyEvidence.filter((dependency) => dependency.state === "confirmed_prerequisite_blocker").map((dependency) => dependency.capabilityKey)),
      dependencyVerificationNeeded: Object.freeze(dependencyEvidence.filter((dependency) => dependency.state === "not_verified").map((dependency) => dependency.capabilityKey)),
      confirmedBlockers: Object.freeze(blocked),
      outstandingVerification: Object.freeze(unverified),
      planningState: blocked.length ? "confirmed_blocker"
        : unverified.length ? "verification_required" : "checks_present_not_approved",
      productionAccepted: null,
      activationAuthorised: false,
      canonicalMappingVerified: mapped,
    });
  }).sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
    a.moduleId.localeCompare(b.moduleId, "en", { numeric: true }));
  const aggregate = (items) => Object.freeze({
    count: items.length,
    blocked: items.filter((item) => item.planningState === "confirmed_blocker").length,
    verificationRequired: items.filter((item) => item.outstandingVerification.length > 0).length,
    unmapped: items.filter((item) => item.mappingReviewState === "mapping_review_required").length,
    taxonomyOnly: items.filter((item) => item.mappingReviewState === "taxonomy_only").length,
    aiEvidenceUnverified: items.filter((item) => item.aiEvidenceState === "tool_contract_not_verified").length,
    withDeclaredIntegrationContracts: items.filter((item) => item.integrationDeclarationState === "integration_contracts_declared").length,
    withRelatedSourceReviews: items.filter((item) => item.relatedSourceReviewCount > 0).length,
    withReviewedImplementationSources: items.filter((item) => item.implementationReviewState === "existing_source_reviewed").length,
    implementationReviewNotRecorded: items.filter((item) => item.implementationReviewState === "source_not_reviewed").length,
  });
  const categories = [...new Set(rows.map((item) => item.category))].sort()
    .map((category) => Object.freeze({ category, ...aggregate(rows.filter((item) => item.category === category)) }));
  const priorities = PRIORITY_ORDER.map((priority) => Object.freeze({
    priority, ...aggregate(rows.filter((item) => item.priority === priority)),
  }));
  return Object.freeze({
    readOnly: true,
    assessmentNotApproval: true,
    productionAcceptedCount: null,
    activationAuthorised: false,
    totals: aggregate(rows),
    priorities: Object.freeze(priorities),
    categories: Object.freeze(categories),
    reviewQueue: Object.freeze(rows.filter((row) => row.mappingReviewState === "mapping_review_required" ||
      row.confirmedBlockers.length > 0 || row.dependencyPrerequisiteBlockers.length > 0)
      .map((row) => Object.freeze({
        moduleId: row.moduleId, displayName: row.displayName, priority: row.priority,
        nextReview: row.suggestedNextReview, mappingReviewState: row.mappingReviewState,
        confirmedBlockers: row.confirmedBlockers, dependencyPrerequisiteBlockers: row.dependencyPrerequisiteBlockers,
        activationAuthorised: false,
      }))),
    entries: Object.freeze(rows),
  });
}
