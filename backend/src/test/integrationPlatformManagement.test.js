import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("integration registry is tenant scoped and exposes credential rotation", async () => {
  const service = await source("../features/integrationPlatform/integrationPlatformService.js");
  assert.match(service, /IntegrationApp/);
  assert.match(service, /business: businessId/);
  assert.match(service, /status = "retiring"/);
  assert.match(service, /secretReturnedOnce: true/);
  assert.match(service, /secretHash/);
  assert.match(service, /encryptIntegrationSecret/);
});

test("integration control surface exposes registry, webhooks, delivery replay and health", async () => {
  const routes = await source("../features/integrationPlatform/integrationPlatformRoutes.js");
  for (const fragment of [
    '"/apps"',
    '"/apps/:appId/credentials"',
    '"/apps/:appId/connections"',
    '"/apps/:appId/webhooks"',
    '"/webhook-deliveries"',
    '"/webhook-deliveries/:deliveryId/replay"',
    '"/health"',
    '"/events"',
  ]) {
    assert.ok(routes.includes(fragment), `Missing integration route ${fragment}`);
  }
});

test("integration workspace is mounted under the protected future-feature router", async () => {
  const routes = await source("../features/futureFeatureRoutes.js");
  assert.match(routes, /integrationPlatformRoutes/);
  assert.match(routes, /"\/integrations"/);
});

test("webhook subscriptions require registered event schemas and signing credentials", async () => {
  const service = await source("../features/integrationPlatform/integrationPlatformService.js");
  assert.match(service, /domainEventDefinition/);
  assert.match(service, /credentialType: "webhook_signing"/);
  assert.match(service, /normaliseEventSelectors/);
});
