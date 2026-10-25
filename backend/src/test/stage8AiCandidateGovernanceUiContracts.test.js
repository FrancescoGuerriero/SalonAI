import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Stage 8 exposes a separate location AI candidate governance workspace", async () => {
  const [page, panel, router, navigation, client] = await Promise.all([
    source("../../../frontend/src/pages/AiCandidateGovernancePage.jsx"),
    source("../../../frontend/src/components/stage8/AiCandidateGovernancePanel.jsx"),
    source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx"),
    source("../../../frontend/src/components/navigation/managementNavigationConfig.js"),
    source("../../../frontend/src/Services/dataHubService.js"),
  ]);

  assert.match(router, /\/admin\/system\/ai-candidate-governance/);
  assert.match(router, /AiCandidateGovernancePage/);
  assert.match(navigation, /"\/admin\/system\/ai-candidate-governance", "AI candidate governance"/);
  assert.match(page, /Location AI candidate governance/);
  assert.match(page, /location-owned offline\/shadow candidate evaluations/);
  assert.match(page, /cannot activate or promote a production model/);

  assert.match(panel, /listAiCandidateEvaluations/);
  assert.match(panel, /reviewAiCandidateEvaluation/);
  assert.match(panel, /qualifyingOfflineCases/);
  assert.match(panel, /requiredOfflineCases/);
  assert.match(panel, /repeatedRunCount/);
  assert.match(panel, /minimumRepeatedRunsPerCase/);
  assert.match(panel, /accepted_for_promotion_proposal/);
  assert.match(panel, /Accept for promotion proposal/);
  assert.match(panel, /Reject candidate/);
  assert.match(panel, /Production promotion, inference and external writes remain disabled/);

  assert.match(client, /ai-gateway\/candidate-evaluations/);
  assert.match(client, /reviewAiCandidateEvaluation/);
  assert.doesNotMatch(panel, /\/promote|\/activate|\/infer|\/train/);
});

test("candidate governance keeps inspection and review permissions distinct", async () => {
  const [page, router, panel] = await Promise.all([
    source("../../../frontend/src/pages/AiCandidateGovernancePage.jsx"),
    source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx"),
    source("../../../frontend/src/components/stage8/AiCandidateGovernancePanel.jsx"),
  ]);

  assert.match(router, /feature-control:read/);
  assert.match(page, /hasPermission\(user, "feature-control:update"\)/);
  assert.match(panel, /canReview && record\.promotionReviewStatus === "pending_review"/);
  assert.match(panel, /does not have the management permission required to decide it/);
});
