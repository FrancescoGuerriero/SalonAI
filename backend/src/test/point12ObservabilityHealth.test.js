import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Observability and Health is tenant-scoped and read-only", async () => {
  const routes = await source("../routes/systemAdministrationRoutes.js");
  const service = await source("../features/observability/systemObservabilityService.js");
  const client = await source("../../../frontend/src/Services/systemObservabilityService.js");
  const systemAdmin = await source("../../../frontend/src/pages/SystemAdministrationPage.jsx");
  const registry = await source("../../../frontend/src/config/aiibpModuleRegistry.js");

  assert.match(routes, /\/observability-health/);
  assert.match(
    routes,
    /observability-health[\s\S]*trustedTenantContextMiddleware[\s\S]*effectiveAuthorityMiddleware[\s\S]*feature-control:read/
  );

  assert.match(
    service,
    /ConnectorHealth\.find\(\{[\s\S]*business:\s*trustedBusinessId/
  );
  assert.match(service, /readOnly:\s*true/);
  assert.match(service, /secretsVisible:\s*false/);
  assert.match(service, /operationalWritesEnabled:\s*false/);
  assert.match(service, /crossTenantTelemetryEnabled:\s*false/);

  assert.match(client, /\/system-administration\/observability-health/);
  assert.match(systemAdmin, /getSystemObservabilityOverview/);
  assert.match(systemAdmin, /Observability & Health/);
  assert.match(registry, /key:\s*"observability-health"[\s\S]*link:\s*"\/admin\/system"/);
});

test("unscoped background-job and dead-letter telemetry fails closed", async () => {
  const service = await source("../features/observability/systemObservabilityService.js");
  const systemAdmin = await source("../../../frontend/src/pages/SystemAdministrationPage.jsx");
  const deadLetterModel = await source("../models/DeadLetterRecord.js");

  assert.doesNotMatch(deadLetterModel, /\bbusiness\s*:/);
  assert.doesNotMatch(deadLetterModel, /\blocation\s*:/);

  assert.match(service, /backgroundJobs:[\s\S]*state:\s*"scope-unavailable"/);
  assert.match(service, /deadLetters:[\s\S]*state:\s*"scope-unavailable"/);
  assert.match(service, /tenantScopedEvidenceAvailable:\s*false/);
  assert.match(service, /exposedRecordCount:\s*0/);
  assert.match(
    service,
    /DeadLetterRecord does not currently carry Business\/Location ownership/
  );

  assert.match(systemAdmin, /No health state is inferred/);
  assert.match(systemAdmin, /0 tenant records exposed/);
});

test("AI observability reuses governed AI evidence rather than activating models", async () => {
  const service = await source("../features/observability/systemObservabilityService.js");

  assert.match(service, /buildAiGovernanceLearningOverview/);
  assert.match(service, /productionTrainingEnabled/);
  assert.match(service, /automaticPromotionEnabled/);
  assert.match(service, /automaticInferenceActivationEnabled/);
  assert.doesNotMatch(service, /\.save\(/);
  assert.doesNotMatch(service, /findOneAndUpdate/);
});
