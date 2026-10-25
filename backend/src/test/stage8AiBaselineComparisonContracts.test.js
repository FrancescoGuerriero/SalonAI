import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("baseline comparison evidence is location-owned, auditable and non-executing", async () => {
  const [model, service, routes] = await Promise.all([
    source("../models/AiBaselineComparisonEvidence.js"),
    source("../features/integrationPlatform/aiBaselineComparisonService.js"),
    source("../features/integrationPlatform/dataHubRoutes.js"),
  ]);

  assert.match(model, /business/);
  assert.match(model, /location/);
  assert.match(model, /candidateEvaluation/);
  assert.match(model, /baselineEvaluation/);
  assert.match(model, /comparisonHash/);
  assert.match(model, /metricDeltas/);
  assert.match(model, /productionPromotionAuthorised/);
  assert.match(model, /productionInferenceAuthorised/);
  assert.match(model, /deploymentAuthorised/);
  assert.match(model, /externalWriteAuthorised/);
  assert.match(model, /enforceNonExecutingBoundary/);

  assert.match(service, /business: businessId/);
  assert.match(service, /location: locationId/);
  assert.match(service, /candidateKind: "deterministic_baseline"/);
  assert.match(service, /evidenceId: candidate\.evidenceId/);
  assert.match(service, /toolKey: candidate\.toolKey/);
  assert.match(service, /candidateVersion: candidate\.baselineVersion/);

  assert.match(routes, /\/ai-gateway\/baseline-comparisons/);
  assert.match(routes, /baselineComparisonController\.create/);
  assert.match(routes, /baselineComparisonController\.list/);
  assert.match(routes, /baselineComparisonController\.get/);
  assert.doesNotMatch(routes, /baseline-comparisons.*\/promote|baseline-comparisons.*\/deploy|baseline-comparisons.*\/activate|baseline-comparisons.*\/infer/);
});

test("baseline comparison computes explicit direction-aware non-degradation evidence", async () => {
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

  assert.match(service, /higher_or_equal/);
  assert.match(service, /lower_or_equal/);
  assert.match(service, /identityNonDegraded/);
  assert.match(service, /safetyNonDegraded/);
  assert.match(service, /reproducibilityNonDegraded/);
  assert.match(service, /allMetricsNonDegraded/);
  assert.match(service, /manifestBaselineAssertion && allMetricsNonDegraded/);
  assert.match(service, /BASELINE_DEGRADATION_/);
  assert.match(service, /BASELINE_REPRODUCIBILITY_NON_DEGRADATION_FAILED/);
  assert.match(service, /matching deterministic baseline evaluation is required/);
});
