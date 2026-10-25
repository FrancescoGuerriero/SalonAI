import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("candidate model requires evidence-derived baseline comparison before artifact promotion eligibility", async () => {
  const model = await source("../models/AiAdvisoryCandidateEvaluation.js");

  assert.match(model, /baselineComparisonSource/);
  assert.match(model, /manifest_declaration/);
  assert.match(model, /evidence_derived/);
  assert.match(model, /baselineComparisonRecord/);
  assert.match(model, /enforceGovernanceLocks/);
  assert.match(model, /baselineComparisonSource !== "evidence_derived"/);
  assert.match(model, /baselineComparisonPassed = false/);
  assert.match(model, /artifactPromotionEligible = false/);
  assert.match(model, /candidateKind === "deterministic_baseline"/);
  assert.match(model, /baselineComparisonSource = "not_applicable"/);
});

test("baseline comparison is location-owned and binds candidate to the same governed evidence case", async () => {
  const [model, service] = await Promise.all([
    source("../models/AiCandidateBaselineComparison.js"),
    source("../features/integrationPlatform/aiBaselineComparisonService.js"),
  ]);

  assert.match(model, /business:[\s\S]*ref: "Business"[\s\S]*required: true/);
  assert.match(model, /location:[\s\S]*ref: "Location"[\s\S]*required: true/);
  assert.match(model, /candidateEvaluation/);
  assert.match(model, /baselineEvaluation/);
  assert.match(model, /metricDeltas/);
  assert.match(model, /nonDegradationPassed/);
  assert.match(model, /overallDecision/);
  assert.match(model, /productionPromotionAuthorised:[\s\S]*default: false/);
  assert.match(model, /productionInferenceAuthorised:[\s\S]*default: false/);
  assert.match(model, /deploymentAuthorised:[\s\S]*default: false/);
  assert.match(model, /externalWriteAuthorised:[\s\S]*default: false/);

  assert.match(service, /business: businessId/);
  assert.match(service, /location: locationId/);
  assert.match(service, /candidate\.evidenceId[\s\S]*baseline\.evidenceId/);
  assert.match(service, /candidate\.toolKey[\s\S]*baseline\.toolKey/);
  assert.match(service, /candidate\.requestedAction[\s\S]*baseline\.requestedAction/);
  assert.match(service, /candidate\.baselineVersion[\s\S]*baseline\.baselineVersion/);
  assert.match(service, /candidate\.policyVersion[\s\S]*baseline\.policyVersion/);
  assert.match(service, /AI_BASELINE_COMPARISON_CASE_MISMATCH/);
});

test("comparison records explicit per-metric deltas and fail-closed non-degradation decisions", async () => {
  const service = await source("../features/integrationPlatform/aiBaselineComparisonService.js");

  for (const metric of [
    "citationIntegrityRate",
    "factualGroundingRate",
    "unsupportedClaimRate",
    "provenanceValidityRate",
    "provenanceCoverageRate",
  ]) {
    assert.match(service, new RegExp(metric));
  }
  assert.match(service, /HIGHER_IS_BETTER/);
  assert.match(service, /LOWER_IS_BETTER/);
  assert.match(service, /candidate >= baseline/);
  assert.match(service, /candidate <= baseline/);
  assert.match(service, /IDENTITY_NON_DEGRADATION_FAILED/);
  assert.match(service, /SAFETY_NON_DEGRADATION_FAILED/);
  assert.match(service, /METRIC_NON_DEGRADATION_FAILED/);
  assert.match(service, /REPEATED_RUN_EVIDENCE_INSUFFICIENT/);
  assert.match(service, /baselineComparisonSource = "evidence_derived"/);
  assert.match(service, /baselineComparisonRecord = comparison\._id/);
  assert.match(service, /distinct\("evidenceId"/);
  assert.match(service, /qualifyingOfflineCases >= requiredOfflineCases/);
});

test("baseline comparison API is separate from model execution and promotion endpoints", async () => {
  const [routes, controller, promotion] = await Promise.all([
    source("../features/integrationPlatform/dataHubRoutes.js"),
    source("../features/integrationPlatform/dataHubController.js"),
    source("../features/integrationPlatform/aiPromotionProposalService.js"),
  ]);

  assert.match(routes, /\/ai-gateway\/baseline-comparisons", write/);
  assert.match(routes, /\/ai-gateway\/baseline-comparisons", read/);
  assert.match(routes, /baseline-comparisons\/:comparisonId", read/);
  assert.match(controller, /createAiBaselineComparison/);
  assert.match(controller, /aiBaselineComparisons/);
  assert.match(controller, /aiBaselineComparison/);
  assert.match(promotion, /baselineComparisonSource !== "evidence_derived"/);
  assert.match(promotion, /!record\.baselineComparisonRecord/);
  assert.doesNotMatch(routes, /baseline-comparisons.*\/promote|baseline-comparisons.*\/deploy|baseline-comparisons.*\/infer|baseline-comparisons.*\/train/);
});
