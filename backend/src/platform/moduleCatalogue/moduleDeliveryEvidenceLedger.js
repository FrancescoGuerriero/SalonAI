/**
 * DEV1-reviewed GitHub source and CI evidence snapshots.
 *
 * Evidence is attributed only to the precise workstream the PR affected.
 * A successful PR does not prove an entire module is complete, deployed,
 * configured, enabled or accepted by a production tenant.
 *
 * This immutable list is NOT fetched at request time. Refresh it only after
 * independently checking GitHub source, review, merge, and workflow status.
 * No external requests, untrusted links or credentials are needed in the API.
 */
export const MODULE_DELIVERY_EVIDENCE_REVIEWED_AT = "2026-11-08";
const REPOSITORY = "FrancescoGuerriero/SalonAI";

const VERIFIED_PR_SNAPSHOTS = Object.freeze([
  { id: 586, moduleIds: ["14", "MKT-06"], head: "5da1037e1af4da6814fe3c9a2afde036855b931c", merge: "e286324d3de8e5a65adaa9109746043cb6a8775c", title: "Editorial placements and backlink evidence", gates: ["DEV1 Marketing Editorial and Backlink Gate", "Stage 1-6 Regression Gate", "SalonAI Fast CI", "SalonAI CodeQL"] },
  { id: 589, moduleIds: ["18", "AI-CORE-01"], head: null, merge: "2630ade9927cc35ee730fad82ddef73295f7f58a", title: "AI Workforce location authority", gates: [] },
  { id: 590, moduleIds: ["18", "AI-CORE-01"], head: null, merge: "ae9d749fea6c1326a4bdb6a1b0b234fb0653c531", title: "Governed read-only tool preflight", gates: [] },
  { id: 591, moduleIds: ["16", "18", "AI-CORE-01"], head: "3ce26cbdb6c7cc69f80b243b4d8aca81e0af33a6", merge: "cba905d4e71ff42d126090cd4c31f118d651bfb3", title: "Audited read-only canonical appointment metrics invocation", gates: ["SalonAI AI Training Validation", "SalonAI Fast CI", "Stage 1-6 Regression Gate", "SalonAI CodeQL"] },
  { id: 592, moduleIds: ["CORE-02", "AI-CORE-01"], head: null, merge: "4bb46813ee7267f510864173c474376e291ddb75", title: "Trusted tenant composition and AI entitlements", gates: [] },
  { id: 593, moduleIds: ["AI-CORE-01"], head: null, merge: "94af9cb3f84e556f05b1d65c4cd7230fb6411380", title: "Feature controls and metric validation", gates: [] },
  { id: 594, moduleIds: ["AI-CORE-02"], head: null, merge: "5b3dab2c5184d0efeb259a0ff834b0d5ede39e59", title: "Read-only AI run and audit reconciliation", gates: [] },
  { id: 595, moduleIds: ["AI-CORE-01"], head: null, merge: "7311a0b82353925e110bd547fa3e5b17b273c796", title: "Bounded A0 metrics invocation deadlines", gates: [] },
  { id: 597, moduleIds: ["AI-CORE-01"], head: null, merge: "76ee5c4529d93724a2ef61a1512ccc7d2f9876c1", title: "Revert unplanned monthly AI quotas", gates: [] },
  { id: 598, moduleIds: ["CORE-02"], head: "358ad50f150ecab67ef65fc2954bf92691027cf7", merge: "0d341e6de7741d9f936d069adf31f7f56d32ac27", title: "Canonical module taxonomy foundation", gates: ["SalonAI Fast CI", "Stage 1-6 Regression Gate", "SalonAI CodeQL"] },
  { id: 599, moduleIds: ["CORE-02"], head: "a04dace00d1dc6fc12374a601710149f5d6f2560", merge: "8e45318faffbbfda27f2fc3a78b271ec1ae4eede", title: "Read-only module management dashboard", gates: ["SalonAI Fast CI", "Stage 1-6 Regression Gate", "SalonAI CodeQL", "Point 8 AI Readiness UI Gate", "Point 8 AIIBP Data Hub Gate"] },
]);

const hex40 = /^[0-9a-f]{40}$/;
const unique = (values) => [...new Set(values)];

/**
 * Evidence records intentionally say `related_work_merged` rather than
 * `module_source_complete`; passing CI only proves the listed workflow
 * ran successfully on the exact pull-request head, not production behaviour.
 */
export function listVerifiedModuleDeliveryEvidence(moduleId) {
  const id = String(moduleId || "").trim();
  return Object.freeze(VERIFIED_PR_SNAPSHOTS
    .filter((pr) => pr.moduleIds.includes(id))
    .map((pr) => Object.freeze({
      evidenceType: "source_and_ci_snapshot",
      sourceOutcome: "related_work_merged",
      sourceUrl: `https://github.com/${REPOSITORY}/pull/${pr.id}`,
      prNumber: pr.id,
      mergeCommitSha: pr.merge,
      commitUrl: `https://github.com/${REPOSITORY}/commit/${pr.merge}`,
      description: pr.title,
      checks: Object.freeze(pr.gates.map((gate) => Object.freeze({
        name: gate,
        conclusion: "success",
        commitSha: pr.head,
        runSearchUrl: `https://github.com/${REPOSITORY}/actions?query=event%3Apull_request`,
      }))),
      verifiedAt: MODULE_DELIVERY_EVIDENCE_REVIEWED_AT,
      verificationMode: "reviewed_gitHub_snapshot",
      deployed: null,
      productionAccepted: null,
    }))));
}

export function validateModuleDeliveryEvidenceLedger(knownModuleIds) {
  const known = new Set(knownModuleIds);
  const ids = new Set();
  for (const record of VERIFIED_PR_SNAPSHOTS) {
    if (ids.has(record.id) || !Number.isInteger(record.id) ||
        !hex40.test(record.merge) ||
        !record.moduleIds.length ||
        record.moduleIds.some((id) => !known.has(id)) ||
        record.gates.some(() => !record.head || !hex40.test(record.head))) {
      throw new Error("Invalid or unreferenced module delivery evidence.");
    }
    ids.add(record.id);
  }
  return Object.freeze({
    valid: true,
    reviewedAt: MODULE_DELIVERY_EVIDENCE_REVIEWED_AT,
    sourcePrCount: ids.size,
    evidencedModuleCount: unique(VERIFIED_PR_SNAPSHOTS.flatMap((pr) => pr.moduleIds)).length,
  });
}

export function inspectModuleDeliveryMilestones(moduleId) {
  const evidence = listVerifiedModuleDeliveryEvidence(moduleId);
  return Object.freeze({
    relatedSourceWorkMerged: evidence.length ? true : null,
    recordedCiSuccess: evidence.some((item) => item.checks.length > 0) ? true : null,
    deployed: null,
    runtimeVerified: null,
    productionAccepted: null,
    evidenceCount: evidence.length,
  });
}
