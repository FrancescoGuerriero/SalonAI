import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import EnterpriseSsoConnection from "../models/EnterpriseSsoConnection.js";

const BUSINESS_ID = "507f1f77bcf86cd799439021";
const USER_ID = "507f1f77bcf86cd799439024";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Enterprise SSO foundation is Business-scoped and runtime-disabled", async () => {
  const connection = new EnterpriseSsoConnection({
    business: BUSINESS_ID,
    key: "corporate-oidc",
    displayName: "Corporate OIDC",
    protocol: "oidc",
    domains: ["example.com"],
    oidc: {
      issuerUrl: "https://id.example.com/",
      clientId: "salonai-enterprise",
      scopes: ["openid", "profile", "email"],
    },
    createdBy: USER_ID,
    updatedBy: USER_ID,
  });

  await assert.doesNotReject(connection.validate());
  assert.equal(connection.runtimeEnabled, false);
  assert.equal(connection.readiness.activationAllowed, false);
  assert.equal(connection.readiness.runtimeAvailable, false);
});

test("Enterprise SSO routes use trusted tenant authority and existing feature-control permissions", async () => {
  const [routes, parent] = await Promise.all([
    source("../features/enterpriseSso/enterpriseSsoRoutes.js"),
    source("../routes/systemAdministrationRoutes.js"),
  ]);

  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /feature-control:read/);
  assert.match(routes, /feature-control:update/);
  assert.match(parent, /"\/enterprise-sso"/);
});

test("Enterprise SSO configuration rejects application-supplied secrets", async () => {
  const service = await source(
    "../features/enterpriseSso/enterpriseSsoService.js"
  );

  assert.match(service, /ENTERPRISE_SSO_SECRET_INPUT_PROHIBITED/);
  assert.match(service, /FORBIDDEN_SECRET_KEYS/);
  assert.match(service, /runtimeAvailable: false/);
  assert.match(service, /activationAllowed: false/);
  assert.match(service, /providerAccepted: false/);
});

test("Enterprise SSO foundation exposes no login, callback or activation endpoint yet", async () => {
  const routes = await source(
    "../features/enterpriseSso/enterpriseSsoRoutes.js"
  );

  assert.doesNotMatch(routes, /\/login|\/callback|\/activate|\/enable/);
});
