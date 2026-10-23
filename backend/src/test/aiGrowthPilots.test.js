import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("AI Retention and Lead pilots are registered as A1 proposal-only agents", async () => {
  const [agents, tools] = await Promise.all([
    source("../features/aiPlatform/aiWorkforceBuiltinAgents.js"),
    source("../features/aiPlatform/aiWorkforceToolRegistry.js"),
  ]);

  assert.match(agents, /"ai-retention"/);
  assert.match(agents, /"ai-lead"/);
  assert.match(agents, /"retention\.risk\.read"/);
  assert.match(agents, /"lead\.score\.read"/);
  assert.match(agents, /"workflow\.enrolment\.propose"/);
  assert.match(agents, /autonomyCeiling:\s*"A1"/);

  assert.match(tools, /"retention\.risk\.read"/);
  assert.match(tools, /"lead\.score\.read"/);
  assert.match(tools, /"workflow\.enrolment\.propose"/);
  assert.match(tools, /requiresHumanApproval:\s*true/);
  assert.match(tools, /maximumAutonomy:\s*"A1"/);
});

test("growth pilots consume tenant-owned canonical evidence and create review proposals only", async () => {
  const service = await source(
    "../features/aiPlatform/aiGrowthPilotService.js"
  );

  assert.match(service, /business:\s*businessId/);
  assert.match(service, /status:\s*"active"/);
  assert.match(service, /getStoredRetentionPrediction/);
  assert.match(service, /predictRetention/);
  assert.match(service, /prediction\.risk/);
  assert.match(service, /risk\.score/);
  assert.match(service, /AI_RETENTION_PREDICTION_STALE/);
  assert.match(service, /sourcePredictionId/);
  assert.match(service, /LeadScore\.findOne/);
  assert.match(service, /AiAgentRun\.create/);
  assert.match(service, /AiActionProposal\.create/);
  assert.match(service, /"retention\.workflow_enrolment_review"/);
  assert.match(service, /"lead\.workflow_enrolment_review"/);
  assert.match(service, /executionStatus:\s*"blocked"/);
  assert.match(service, /automaticExecution:\s*false/);

  assert.doesNotMatch(service, /boundedNumber\(prediction\.score/);
  assert.doesNotMatch(service, /executeWorkflowRun/);
  assert.doesNotMatch(service, /ScheduledCommunication/);
  assert.doesNotMatch(service, /setLeadNurture/);
  assert.doesNotMatch(service, /createManagedAppointment/);
});

test("growth pilot conversion measurement uses the governed outcome ledger", async () => {
  const service = await source(
    "../features/aiPlatform/aiGrowthPilotService.js"
  );

  assert.match(service, /observeAiActionOutcome/);
  assert.match(service, /"retention\.rebooking_conversion"/);
  assert.match(service, /"lead\.customer_conversion"/);
  assert.match(service, /payload\.implemented !== true/);
  assert.match(service, /status:\s*"not_implemented"/);
  assert.match(service, /status:\s*"implemented"/);
  assert.match(service, /conversionObserved/);
});

test("AI growth pilot routes use the trusted tenant/effective-authority chain", async () => {
  const routes = await source(
    "../features/aiRecommendations/aiRecommendationRoutes.js"
  );

  assert.match(routes, /"\/workforce\/pilots\/retention"/);
  assert.match(routes, /"\/workforce\/pilots\/leads\/:leadId"/);
  assert.match(routes, /"\/workforce\/pilots\/proposals\/:proposalId\/measure"/);
  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /tenantAwareAiChain/);
});
