import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("AI candidate evaluation records are location-owned and production locked", async () => {
  const [model, service] = await Promise.all([
    source("../models/AiAdvisoryCandidateEvaluation.js"),
    source("../features/integrationPlatform/aiCandidateEvaluationService.js"),
  ]);

  assert.match(model, /business:\s*\{[\s\S]*?ref:\s*"Business"[\s\S]*?required:\s*true/);
  assert.match(model, /location:\s*\{[\s\S]*?ref:\s*"Location"[\s\S]*?required:\s*true/);
  assert.match(model, /baselineManifestAssertion/);
  assert.match(model, /baselineComparisonPassed/);
  assert.match(model, /baselineComparisonSource/);
  assert.match(model, /baselineComparisonEvidence/);
  assert.match(model, /artifactPromotionEligible/);
  assert.match(model, /promotionReadiness/);
  assert.match(model, /accepted_for_promotion_proposal/);
  assert.match(model, /productionPromotionAuthorised:\s*\{[\s\S]*?default:\s*false/);
  assert.match(model, /productionInferenceAuthorised:\s*\{[\s\S]*?default:\s*false/);
  assert.match(model, /externalWriteAuthorised:\s*\{[\s\S]*?default:\s*false/);
  assert.match(model, /enforceGovernanceLocks/);
  assert.match(model, /baselineComparisonSource !== "evidence_derived"/);
  assert.match(model, /promotionReadiness\.qualifyingOfflineCases = 0/);
  assert.match(model, /promotionReadiness\.suiteGatePassed = false/);

  assert.match(service, /business:\s*businessId/);
  assert.match(service, /location:\s*locationId/);
  assert.match(service, /scope\.locations/);
  assert.match(service, /must explicitly include the selected location/);
  assert.match(service, /evaluation\.beatsRulesBaseline === true/);
  assert.match(service, /artifactPromotionEligible:\s*lifecycle === "candidate" && baselineComparisonPassed/);
  assert.match(service, /productionPromotionAuthorised:\s*false/);
  assert.match(service, /productionInferenceAuthorised:\s*false/);
  assert.match(service, /externalWriteAuthorised:\s*false/);
});

test("candidate evaluation verifies canonical evidence fingerprints before calling the evaluator", async () => {
  const service = await source("../features/integrationPlatform/aiCandidateEvaluationService.js");

  assert.match(service, /EVIDENCE_CONTRACT = "data_hub_evidence_v1"/);
  assert.match(service, /sourceContractVersion/);
  assert.match(service, /expectedEvidenceId = sha256\(fingerprintInput\)/);
  assert.match(service, /AI_EVALUATION_EVIDENCE_FINGERPRINT_MISMATCH/);
  assert.match(service, /AI_EVALUATION_BUSINESS_MISMATCH/);
  assert.match(service, /AI_EVALUATION_LOCATION_MISMATCH/);
  assert.match(service, /AI_EVALUATION_CANDIDATE_IDENTITY_MISMATCH/);
  assert.match(service, /\/api\/v1\/ai-gateway\/advisory-evaluation-policy/);
  assert.match(service, /\/api\/v1\/ai-gateway\/evaluate-advisory/);
});

test("promotion review requires the complete policy benchmark suite, not one passing case", async () => {
  const [model, service] = await Promise.all([
    source("../models/AiAdvisoryCandidateEvaluation.js"),
    source("../features/integrationPlatform/aiCandidateEvaluationService.js"),
  ]);

  assert.match(model, /requiredOfflineCases/);
  assert.match(model, /qualifyingOfflineCases/);
  assert.match(model, /minimumRepeatedRunsPerCase/);
  assert.match(model, /repeatedRunCount/);
  assert.match(model, /candidateOutputIncludedInRepeatedRuns/);
  assert.match(model, /repeatedRunEvidenceSufficient/);
  assert.match(model, /suiteGatePassed/);

  assert.match(service, /policy\.minimumOfflineCases/);
  assert.match(service, /policy\.minimumRepeatedRunsPerCase/);
  assert.match(service, /candidateOutputIncludedInRepeatedRuns/);
  assert.match(service, /repeatedOutputHashes\.length >= minimumRepeatedRunsPerCase/);
  assert.match(service, /distinct\("evidenceId"/);
  assert.match(service, /qualifyingOfflineCases >= requiredOfflineCases/);
  assert.match(service, /suiteGatePassed/);
  assert.match(service, /full benchmark-suite gates/);
});

test("candidate review can approve a proposal only, never production promotion", async () => {
  const [controller, routes, service] = await Promise.all([
    source("../features/integrationPlatform/dataHubController.js"),
    source("../features/integrationPlatform/dataHubRoutes.js"),
    source("../features/integrationPlatform/aiCandidateEvaluationService.js"),
  ]);

  assert.match(controller, /aiCandidateEvaluate/);
  assert.match(controller, /aiCandidateEvaluations/);
  assert.match(controller, /aiCandidateEvaluation/);
  assert.match(controller, /aiCandidateReview/);

  assert.match(routes, /\/ai-gateway\/candidate-evaluations", aiUse/);
  assert.match(routes, /\/ai-gateway\/candidate-evaluations", read/);
  assert.match(routes, /candidate-evaluations\/:recordId", read/);
  assert.match(routes, /candidate-evaluations\/:recordId\/review", write/);

  assert.match(service, /eligibleForPromotionReview/);
  assert.match(service, /AI_CANDIDATE_NOT_ELIGIBLE_FOR_PROMOTION_REVIEW/);
  assert.match(service, /AI_CANDIDATE_REVIEW_ALREADY_FINAL/);
  assert.match(service, /accepted_for_promotion_proposal/);
  assert.match(service, /future promotion proposal only/);
  assert.doesNotMatch(routes, /\/promote|\/activate|\/infer|\/train/);
});

test("model candidate kinds fail closed and require governed model artifact provenance", async () => {
  const service = await source("../features/integrationPlatform/aiCandidateEvaluationService.js");

  assert.match(service, /AI_CANDIDATE_KIND_INVALID/);
  assert.match(service, /MODEL_ARTIFACT_SCHEMA = "salonai\.model-artifact\.v1"/);
  assert.match(service, /AI_MODEL_ARTIFACT_MANIFEST_REQUIRED/);
  assert.match(service, /AI_MODEL_ARTIFACT_CHECKSUM_INVALID/);
  assert.match(service, /AI_MODEL_ARTIFACT_BUSINESS_SCOPE_MISMATCH/);
  assert.match(service, /AI_MODEL_ARTIFACT_LOCATION_SCOPE_MISMATCH/);
  assert.match(service, /AI_MODEL_ARTIFACT_LIFECYCLE_INVALID/);
  assert.match(service, /AI_CANDIDATE_REPEATED_HASH_INVALID/);
});
