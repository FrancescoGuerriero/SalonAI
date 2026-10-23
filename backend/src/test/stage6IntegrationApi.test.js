import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  INTEGRATION_SCOPES,
} from "../features/integrationPlatform/integrationScopeCatalogue.js";

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("Stage 6 Integration API exposes explicit lead read/write scopes", () => {
  assert.ok(INTEGRATION_SCOPES.includes("lead:read"));
  assert.ok(INTEGRATION_SCOPES.includes("lead:write"));
});

test("partner lead capture reuses canonical capture and acquisition mapping", async () => {
  const routes = await source("../features/integrationPlatform/integrationApiRoutes.js");
  assert.match(routes, /requireIntegrationScopes\("lead:read"\)/);
  assert.match(routes, /requireIntegrationScopes\("lead:write"\)/);
  assert.match(routes, /normaliseLeadAcquisitionPayload/);
  assert.match(routes, /captureLead/);
  assert.match(routes, /businessId: request\.integrationAuth\.businessId/);
  assert.match(routes, /appId: request\.integrationAuth\.appId/);
  assert.match(routes, /credentialVersion: request\.integrationAuth\.credentialVersion/);
});

test("partner lead API does not create an alternate customer or booking path", async () => {
  const routes = await source("../features/integrationPlatform/integrationApiRoutes.js");
  assert.doesNotMatch(routes, /Customer\.create/);
  assert.doesNotMatch(routes, /Appointment\.create/);
  assert.doesNotMatch(routes, /new Customer/);
  assert.doesNotMatch(routes, /new Appointment/);
});
