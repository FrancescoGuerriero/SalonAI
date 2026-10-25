import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Stage 8 exposes a location-owned AI readiness workspace", async () => {
  const [page, router, navigation, client] = await Promise.all([
    source("../../../frontend/src/pages/AiReadinessPage.jsx"),
    source("../../../frontend/src/components/stage8/Stage8WorkspaceRouter.jsx"),
    source("../../../frontend/src/components/navigation/managementNavigationConfig.js"),
    source("../../../frontend/src/Services/dataHubService.js"),
  ]);

  assert.match(router, /\/admin\/system\/ai-readiness/);
  assert.match(router, /AiReadinessPage/);
  assert.match(navigation, /"\/admin\/system\/ai-readiness", "AI readiness"/);
  assert.match(page, /selected SALON AI location/);
  assert.match(page, /Location-owned/);
  assert.match(page, /Planning only/);
  assert.match(page, /Inference disabled/);
  assert.match(page, /External writes disabled/);
  assert.match(page, /Human approval required/);
  assert.match(page, /listAiGatewayInvocations/);
  assert.match(page, /getAiGatewayEvidence/);
  assert.match(page, /planAiGateway/);
  assert.match(client, /ai-gateway\/invocations/);
  assert.match(client, /ai-gateway\/evidence/);
  assert.match(client, /ai-gateway\/plan/);
});

test("AI readiness planning stays on the governed planning endpoint", async () => {
  const page = await source("../../../frontend/src/pages/AiReadinessPage.jsx");
  assert.match(page, /toolKey:\s*"marketing-insights"/);
  assert.match(page, /requestedAction/);
  assert.match(page, /does not run inference, train or promote a model/);
  assert.doesNotMatch(page, /\/infer|\/train|\/promote|externalWriteAuthorised:\s*true/);
});
