import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("promotion proposal UI stays planning-only and permission-scoped", async () => {
  const [page, router, client, candidatePage] = await Promise.all([
    source("../../../frontend/src/pages/AiPromotionProposalPage.jsx"),
    source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx"),
    source("../../../frontend/src/Services/dataHubService.js"),
    source("../../../frontend/src/pages/AiCandidateGovernancePage.jsx"),
  ]);

  assert.match(router, /\/admin\/system\/ai-promotion-proposals/);
  assert.match(router, /feature-control:read/);
  assert.match(candidatePage, /Promotion dossiers/);
  assert.match(client, /listAiPromotionProposals/);
  assert.match(client, /createAiPromotionProposal/);
  assert.match(client, /updateAiPromotionProposal/);
  assert.match(page, /feature-control:update/);
  assert.match(page, /Create draft dossier/);
  assert.match(page, /Mark ready for change review/);
  assert.match(page, /Withdraw/);
  assert.match(page, /Deployment disabled/);
  assert.match(page, /Production promotion disabled/);
  assert.match(page, /Production inference disabled/);
  assert.match(page, /External writes disabled/);
  assert.doesNotMatch(page, /Promote model|Activate model|Deploy model|Run inference|\/promote|\/activate|\/deploy|\/infer|\/train/);
});

test("promotion proposal UI exposes governed change-planning evidence", async () => {
  const page = await source("../../../frontend/src/pages/AiPromotionProposalPage.jsx");
  for (const label of [
    "Rationale",
    "Expected benefit",
    "Risk assessment",
    "Rollback plan",
    "Monitoring plan",
    "Incident owner",
    "Proposed deployment window",
    "Readiness checklist",
  ]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /qualifyingOfflineCases/);
  assert.match(page, /requiredOfflineCases/);
  assert.match(page, /accepted_for_promotion_proposal/);
});
