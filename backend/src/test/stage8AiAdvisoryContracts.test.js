import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("location AI advisory preview remains deterministic, cited and non-executing", async () => {
  const [bridge, model, controller, routes] = await Promise.all([
    source("../features/integrationPlatform/dataHubAiGatewayService.js"),
    source("../models/AiGatewayInvocation.js"),
    source("../features/integrationPlatform/dataHubController.js"),
    source("../features/integrationPlatform/dataHubRoutes.js"),
  ]);

  assert.match(bridge, /\/api\/v1\/ai-gateway\/advisory-preview/);
  assert.match(bridge, /status:\s*"advisory_previewed"/);
  assert.match(bridge, /deterministicBaseline:\s*true/);
  assert.match(bridge, /modelInferenceExecuted:\s*false/);
  assert.match(bridge, /inferenceExecuted:\s*false/);
  assert.match(bridge, /executionAuthorised:\s*false/);
  assert.match(bridge, /externalWriteAuthorised:\s*false/);
  assert.match(model, /"advisory_previewed"/);
  assert.match(model, /location:\s*\{[\s\S]*?ref:\s*"Location"[\s\S]*?required:\s*true/);
  assert.match(controller, /previewDataHubAiAdvisory/);
  assert.match(routes, /const aiUse = requirePermissions\("ai:use"\)/);
  assert.match(routes, /\/ai-gateway\/advisory-preview", aiUse/);
});

test("AI-service advisory baseline cites canonical facts and refuses forecasting", async () => {
  const [route, adviser, schemas] = await Promise.all([
    source("../../../ai-service/app/api/routes/ai_gateway.py"),
    source("../../../ai-service/app/services/canonical_adviser.py"),
    source("../../../ai-service/app/schemas/ai_gateway.py"),
  ]);

  assert.match(route, /\/advisory-preview/);
  assert.match(route, /AI_ADVISORY_FORECAST_REQUIRES_GOVERNED_MODEL/);
  assert.match(adviser, /salonai-canonical-adviser-baseline-v1/);
  assert.match(adviser, /model_inference_executed=False/);
  assert.match(adviser, /external_write_authorised=False/);
  assert.match(adviser, /fact_index=index/);
  assert.match(adviser, /evidence_id=evidence_id/);
  assert.match(schemas, /class AdvisoryCitation/);
  assert.match(schemas, /class GatewayAdvisoryResponse/);
});

test("AI readiness UI exposes cited advisory preview without a model execution control", async () => {
  const [page, client] = await Promise.all([
    source("../../../frontend/src/pages/AiReadinessPage.jsx"),
    source("../../../frontend/src/Services/dataHubService.js"),
  ]);

  assert.match(client, /ai-gateway\/advisory-preview/);
  assert.match(page, /previewAiAdvisory/);
  assert.match(page, /Generate advisory preview/);
  assert.match(page, /Cited deterministic baseline/);
  assert.match(page, /Model inference disabled/);
  assert.match(page, /Human approval required/);
  assert.match(page, /requestedAction === "forecast"/);
  assert.doesNotMatch(page, /\/infer|\/train|\/promote/);
});
