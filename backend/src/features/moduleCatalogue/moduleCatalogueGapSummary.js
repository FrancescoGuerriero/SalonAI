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
    return Object.freeze({
      moduleId: definition.moduleId,
      displayName: definition.displayName,
      category: definition.category,
      priority: definition.priority,
      kind: definition.kind,
      aiOpportunity: definition.aiOpportunity,
      mappedCapabilityPackKeys: definition.capabilityPackKeys,
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
    unmapped: items.filter((item) => !item.canonicalMappingVerified).length,
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
    entries: Object.freeze(rows),
  });
}
