import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("offline/shadow experiment runner is location-owned and non-production", async () => {
  const [model, service, routes, controller] = await Promise.all([
    source("../models/AiOfflineExperimentRun.js"),
    source("../features/integrationPlatform/aiOfflineExperimentService.js"),
    source("../features/integrationPlatform/dataHubRoutes.js"),
    source("../features/integrationPlatform/dataHubController.js"),
  ]);

  assert.match(model, /location:[\s\S]*required: true/);
  assert.match(model, /candidateKind:[\s\S]*shadow_model[\s\S]*offline_model/);
  assert.match(model, /productionPromotionAuthorised:[\s\S]*default: false/);
  assert.match(model, /productionInferenceAuthorised:[\s\S]*default: false/);
  assert.match(model, /deploymentAuthorised:[\s\S]*default: false/);
  assert.match(model, /externalWriteAuthorised:[\s\S]*default: false/);

  assert.match(service, /MAX_CASES = 25/);
  assert.match(service, /MIN_REPEATS = 3/);
  assert.match(service, /MAX_REPEATS = 10/);
  assert.match(service, /repeatedCandidates\.map\(sha256\)/);
  assert.match(service, /Repeated outputs must include the primary candidate output exactly/);
  assert.match(service, /evaluateAndRecordCandidate/);
  assert.match(service, /business: businessId, location: locationId/);
  assert.match(service, /productionPromotionAuthorised: false/);
  assert.match(service, /productionInferenceAuthorised: false/);
  assert.match(service, /deploymentAuthorised: false/);
  assert.match(service, /externalWriteAuthorised: false/);

  assert.match(routes, /post\("\/ai-gateway\/offline-experiments", aiUse/);
  assert.match(routes, /get\("\/ai-gateway\/offline-experiments", read/);
  assert.match(routes, /get\("\/ai-gateway\/offline-experiments\/:runId", read/);
  assert.match(controller, /runAiOfflineExperiment/);
  assert.match(controller, /offlineExperimentService\.runOfflineExperiment/);

  assert.doesNotMatch(service, /\/promote|\/activate|\/deploy|\/train|\/infer/);
});

test("offline experiment ledger stores bounded audit summaries rather than raw candidate/evidence payloads", async () => {
  const model = await source("../models/AiOfflineExperimentRun.js");

  assert.match(model, /evaluationRecord/);
  assert.match(model, /evidenceId/);
  assert.match(model, /metrics/);
  assert.match(model, /blockers/);
  assert.doesNotMatch(model, /rawEvidence|rawCandidate|candidatePayload|evidencePayload/);
});
