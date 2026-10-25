import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("promotion proposal dossiers are location-owned and non-executing", async () => {
  const [model, service] = await Promise.all([
    source("../models/AiPromotionProposalDossier.js"),
    source("../features/integrationPlatform/aiPromotionProposalService.js"),
  ]);

  assert.match(model, /business:\s*\{[\s\S]*?ref:\s*"Business"[\s\S]*?required:\s*true/);
  assert.match(model, /location:\s*\{[\s\S]*?ref:\s*"Location"[\s\S]*?required:\s*true/);
  assert.match(model, /candidateEvaluation:[\s\S]*?AiAdvisoryCandidateEvaluation/);
  assert.match(model, /proposalStatus:[\s\S]*?ready_for_change_review/);
  assert.match(model, /productionPromotionAuthorised:\s*\{[\s\S]*?default:\s*false/);
  assert.match(model, /productionInferenceAuthorised:\s*\{[\s\S]*?default:\s*false/);
  assert.match(model, /deploymentAuthorised:\s*\{[\s\S]*?default:\s*false/);
  assert.match(model, /externalWriteAuthorised:\s*\{[\s\S]*?default:\s*false/);
  assert.match(model, /enforceNonExecutingBoundary/);

  assert.match(service, /productionPromotionAuthorised:\s*false/);
  assert.match(service, /productionInferenceAuthorised:\s*false/);
  assert.match(service, /deploymentAuthorised:\s*false/);
  assert.match(service, /externalWriteAuthorised:\s*false/);
});

test("dossiers can only originate from the complete accepted candidate governance chain", async () => {
  const service = await source("../features/integrationPlatform/aiPromotionProposalService.js");

  assert.match(service, /accepted_for_promotion_proposal/);
  assert.match(service, /eligibleForPromotionReview !== true/);
  assert.match(service, /qualityGatePassed !== true/);
  assert.match(service, /baselineComparisonPassed !== true/);
  assert.match(service, /artifactPromotionEligible !== true/);
  assert.match(service, /promotionReadiness\?\.suiteGatePassed !== true/);
  assert.match(service, /AI_PROMOTION_PROPOSAL_CANDIDATE_NOT_READY/);
  assert.match(service, /AI_PROMOTION_PROPOSAL_ARTIFACT_REQUIRED/);
  assert.match(service, /AI_PROMOTION_PROPOSAL_ALREADY_EXISTS/);
});

test("ready-for-change-review is a planning state requiring rollback and monitoring evidence", async () => {
  const [model, service] = await Promise.all([
    source("../models/AiPromotionProposalDossier.js"),
    source("../features/integrationPlatform/aiPromotionProposalService.js"),
  ]);

  assert.match(model, /rollbackPlanDocumented/);
  assert.match(model, /monitoringPlanDocumented/);
  assert.match(model, /incidentOwnerAssigned/);
  assert.match(model, /deploymentWindowDocumented/);
  assert.match(service, /mark_ready_for_change_review/);
  assert.match(service, /readinessComplete\(dossier\)/);
  assert.match(service, /AI_PROMOTION_PROPOSAL_INCOMPLETE/);
  assert.match(service, /future controlled change review/);
  assert.match(service, /No deployment, promotion or inference was authorised/);
});

test("Data Hub exposes dossier planning APIs but no execution or promotion endpoint", async () => {
  const [controller, routes] = await Promise.all([
    source("../features/integrationPlatform/dataHubController.js"),
    source("../features/integrationPlatform/dataHubRoutes.js"),
  ]);

  assert.match(controller, /createAiPromotionProposal/);
  assert.match(controller, /updateAiPromotionProposal/);
  assert.match(controller, /aiPromotionProposals/);
  assert.match(controller, /aiPromotionProposal/);
  assert.match(routes, /\/ai-gateway\/promotion-proposals", read/);
  assert.match(routes, /\/ai-gateway\/promotion-proposals", write/);
  assert.match(routes, /promotion-proposals\/:dossierId", read/);
  assert.match(routes, /promotion-proposals\/:dossierId", write/);
  assert.doesNotMatch(routes, /\/promote|\/activate|\/deploy|\/infer|\/train/);
});
