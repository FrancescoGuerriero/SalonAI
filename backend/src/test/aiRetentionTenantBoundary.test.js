import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("legacy retention reporting endpoints use trusted tenant authority", async () => {
  const [routes, controller] = await Promise.all([
    source("../features/ai/aiRoutes.js"),
    source("../features/ai/aiController.js"),
  ]);

  assert.match(routes, /tenantRetentionChain/);
  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /requirePermissions\("ai:use"\)/);
  assert.match(controller, /aiRetentionTenantService/);
  assert.match(controller, /effectiveAuthority\?\.businessId/);
});

test("tenant retention facade never falls back to a global empty-ID batch", async () => {
  const service = await source(
    "../features/ai/aiRetentionTenantService.js"
  );

  assert.match(service, /business: businessId/);
  assert.match(service, /Customer\.findOne\(\{[\s\S]*business: businessId/);
  assert.match(service, /if \(customerIds\.length === 0\)/);
  assert.match(service, /requested: 0/);
  assert.match(service, /customer: \{ \$in: customerIds \}/);
});

test("growth pilots stay proposal-only while retention reads are tenant scoped", async () => {
  const [growthPilot, tenantRetention] = await Promise.all([
    source("../features/aiPlatform/aiGrowthPilotService.js"),
    source("../features/ai/aiRetentionTenantService.js"),
  ]);

  assert.match(growthPilot, /proposalOnly: true/);
  assert.match(growthPilot, /automaticExecution: false/);
  assert.match(growthPilot, /business: businessId/);
  assert.doesNotMatch(tenantRetention, /sendCommunication|ScheduledCommunication\.create/);
});
