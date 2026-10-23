import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import AiActionOutcome from "../features/aiPlatform/AiActionOutcome.js";

const BUSINESS_ID = "507f1f77bcf86cd799439021";
const PROPOSAL_ID = "507f1f77bcf86cd799439022";
const USER_ID = "507f1f77bcf86cd799439024";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("AI Workforce governance routes use trusted tenant authority", async () => {
  const routes = await source(
    "../features/aiRecommendations/aiRecommendationRoutes.js"
  );

  for (const path of [
    "/adviser/proposals",
    "/workforce/registry",
    "/workforce/runs",
    "/workforce/proposals",
    "/workforce/outcomes",
  ]) {
    assert.match(routes, new RegExp(path.replaceAll("/", "\\/")));
  }
  assert.match(routes, /tenantAwareAiChain/);
  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.doesNotMatch(routes, /workforce\/proposals\/:proposalId\/execute/);
});

test("Adviser proposal guard resolves proposal inside effective Business", async () => {
  const guard = await source(
    "../features/aiRecommendations/aiAdviserTenantProposalGuard.js"
  );

  assert.match(guard, /business: effectiveBusinessId\(request\)/);
  assert.match(guard, /hasRequestPermission\(request, proposal\.requiredPermission\)/);
  assert.match(guard, /proposal\.business = effectiveBusinessId\(request\)/);
});

test("AI action outcome is tenant-owned human observation evidence", async () => {
  const outcome = new AiActionOutcome({
    business: BUSINESS_ID,
    proposal: PROPOSAL_ID,
    status: "implemented",
    taskSuccess: true,
    observedBy: USER_ID,
  });

  await assert.doesNotReject(outcome.validate());
  assert.equal(outcome.status, "implemented");
  assert.equal(outcome.taskSuccess, true);
});

test("outcome governance never executes the proposal mutation", async () => {
  const service = await source(
    "../features/aiPlatform/aiWorkforceGovernanceService.js"
  );

  assert.match(service, /automaticExecution: false/);
  assert.match(service, /AiActionOutcome\.create/);
  assert.match(service, /AiAgentRun\.updateOne/);
  assert.doesNotMatch(service, /createManagedAppointment|rescheduleAppointment|sendCommunication|updateCustomer|createPurchaseOrder/);
});

test("AI Workforce retains A1 ceiling and direct mutation prohibition", async () => {
  const [policy, tools] = await Promise.all([
    source("../features/aiPlatform/aiWorkforcePolicy.js"),
    source("../features/aiPlatform/aiWorkforceToolRegistry.js"),
  ]);

  assert.match(policy, /AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING[\s\S]*"A1"/);
  assert.match(policy, /AI_DIRECT_MUTATION_BLOCKED/);
  assert.match(tools, /mutation:[\s\S]*false/);
});
