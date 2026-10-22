import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hasIntegrationScope,
} from "../features/integrationPlatform/integrationApiAuth.js";
import {
  normaliseIntegrationScopes,
} from "../features/integrationPlatform/integrationScopeCatalogue.js";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("integration scopes support exact and domain wildcard grants", () => {
  assert.equal(
    hasIntegrationScope(["customer:read"], "customer:read"),
    true
  );
  assert.equal(
    hasIntegrationScope(["customer:*"], "customer:write"),
    true
  );
  assert.equal(
    hasIntegrationScope(["appointment:read"], "appointment:write"),
    false
  );
  assert.equal(hasIntegrationScope(["*"], "payment:write"), true);
});

test("integration scope catalogue rejects unknown wildcard domains", () => {
  assert.deepEqual(
    normaliseIntegrationScopes([
      "customer:read",
      "customer:read",
      "appointment:*",
    ]),
    ["customer:read", "appointment:*"]
  );

  assert.throws(
    () => normaliseIntegrationScopes(["unknown:*"]),
    /Unsupported integration scope/
  );
});

test("integration API is credential-authenticated before staff JWT protection", async () => {
  const auth = await source(
    "../features/integrationPlatform/integrationApiAuth.js"
  );
  assert.match(auth, /CredentialVersion\.findOne/);
  assert.match(auth, /integrationSecretMatches/);
  assert.match(auth, /IntegrationRateLimitBucket\.findOneAndUpdate/);
  assert.match(auth, /Retry-After/);
  assert.match(auth, /INTEGRATION_SCOPE_REQUIRED/);

  const routes = await source("../features/futureFeatureRoutes.js");
  const externalMount = routes.indexOf('"/integrations/v1"');
  const staffProtect = routes.indexOf("router.use(protect)");
  assert.ok(externalMount >= 0);
  assert.ok(staffProtect > externalMount);
});
