import assert from "node:assert/strict";
import test from "node:test";

import {
  INTEGRATION_IMPLEMENTATION_STATUS,
  getIntegrationDefinition,
  integrationCatalog,
} from "../integrations/integrationCatalog.js";
import { IntegrationRegistry } from "../integrations/integrationRegistry.js";

test("integration catalogue has unique stable ids and capabilities", () => {
  const ids = integrationCatalog.map((definition) => definition.id);

  assert.equal(new Set(ids).size, ids.length);

  for (const definition of integrationCatalog) {
    assert.ok(definition.id);
    assert.ok(definition.provider);
    assert.ok(definition.category);
    assert.ok(definition.capabilities.length > 0);
    assert.equal(
      new Set(definition.capabilities).size,
      definition.capabilities.length
    );
  }
});

test("catalogue distinguishes implemented and planned providers", () => {
  assert.equal(
    getIntegrationDefinition("stripe")?.status,
    INTEGRATION_IMPLEMENTATION_STATUS.IMPLEMENTED
  );
  assert.equal(
    getIntegrationDefinition("twilio")?.status,
    INTEGRATION_IMPLEMENTATION_STATUS.IMPLEMENTED
  );
  assert.equal(
    getIntegrationDefinition("google-calendar")?.status,
    INTEGRATION_IMPLEMENTATION_STATUS.PLANNED
  );
});

test("registry exposes metadata without exposing adapter internals", () => {
  const registry = new IntegrationRegistry();
  const adapter = {
    secret: "must-not-be-serialised",
    send: () => "ok",
  };

  const descriptor = registry.register({
    id: "twilio",
    capabilities: ["messaging.whatsapp"],
    adapter,
  });

  assert.equal(registry.has("twilio"), true);
  assert.equal(registry.getAdapter("twilio"), adapter);
  assert.equal(descriptor.registered, true);
  assert.deepEqual(descriptor.capabilities, ["messaging.whatsapp"]);
  assert.equal("adapter" in descriptor, false);
  assert.equal("secret" in descriptor, false);
  assert.equal(JSON.stringify(descriptor).includes(adapter.secret), false);
});

test("registry rejects unknown integrations and unsupported capabilities", () => {
  const registry = new IntegrationRegistry();

  assert.throws(
    () => registry.register({ id: "unknown", adapter: {} }),
    /Unknown integration/
  );

  assert.throws(
    () =>
      registry.register({
        id: "stripe",
        capabilities: ["calendar.write"],
        adapter: {},
      }),
    /unsupported capabilities/
  );
});

test("registry prevents duplicate provider registration", () => {
  const registry = new IntegrationRegistry();

  registry.register({
    id: "stripe",
    capabilities: ["payments.checkout"],
    adapter: {},
  });

  assert.throws(
    () =>
      registry.register({
        id: "stripe",
        capabilities: ["payments.webhooks"],
        adapter: {},
      }),
    /already registered/
  );
});
