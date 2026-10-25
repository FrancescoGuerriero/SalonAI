import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("offline experiment comparison UI is location-scoped and read-only", async () => {
  const [page, router, client, candidatePage] = await Promise.all([
    source("../../../frontend/src/pages/AiOfflineExperimentComparisonPage.jsx"),
    source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx"),
    source("../../../frontend/src/Services/dataHubService.js"),
    source("../../../frontend/src/pages/AiCandidateGovernancePage.jsx"),
  ]);

  assert.match(router, /\/admin\/system\/ai-offline-experiments/);
  assert.match(router, /feature-control:read/);
  assert.match(candidatePage, /Experiment comparison/);
  assert.match(client, /listAiOfflineExperiments/);
  assert.match(client, /getAiOfflineExperiment/);
  assert.match(client, /runAiOfflineExperiment/);
  assert.match(client, /listAiBaselineComparisons/);
  assert.match(client, /getAiBaselineComparison/);
  assert.match(client, /createAiBaselineComparison/);
  assert.match(page, /Offline experiment comparison/);
  assert.match(page, /location-owned shadow\/offline model artifacts/);
  assert.match(page, /Evidence-derived baseline deltas/);
  assert.match(page, /same location, action, policy and canonical evidence case/);
  assert.match(page, /Production inference disabled/);
  assert.match(page, /Production promotion disabled/);
  assert.match(page, /Deployment disabled/);
  assert.match(page, /External writes disabled/);
  assert.doesNotMatch(page, /Train model|Deploy model|Promote model|Activate model|Run inference|\/train|\/deploy|\/promote|\/activate|\/infer/);
});

test("offline experiment comparison UI exposes benchmark, quality and per-metric baseline evidence", async () => {
  const page = await source("../../../frontend/src/pages/AiOfflineExperimentComparisonPage.jsx");

  for (const token of [
    "25 benchmark cases",
    "qualityPassedCases",
    "baselinePassedCases",
    "reproducibleCases",
    "promotionReviewEligibleCases",
    "citationIntegrityRate",
    "factualGroundingRate",
    "unsupportedClaimRate",
    "provenanceValidityRate",
    "artifactSha256",
    "candidateVersion",
    "metricDeltas",
    "baselineValue",
    "candidateValue",
    "nonDegraded",
    "qualifyingOfflineCases",
    "requiredOfflineCases",
    "suiteGatePassed",
    "repeatedRunEvidenceSufficient",
    "blockers",
  ]) {
    assert.match(page, new RegExp(token));
  }
});
