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

test("Enterprise SSO configuration rejects application secrets and uses governed OIDC credentials", async () => {
  const [model, service] = await Promise.all([
    source("../models/EnterpriseSsoConnection.js"),
    source("../features/enterpriseSso/enterpriseSsoService.js"),
  ]);

  assert.match(service, /ENTERPRISE_SSO_SECRET_INPUT_PROHIBITED/);
  assert.match(service, /FORBIDDEN_SECRET_KEYS/);
  assert.match(model, /credentialVersion:[\s\S]*ref: "CredentialVersion"/);
  assert.match(service, /CredentialVersion\.findOne/);
  assert.match(service, /credentialType: "oauth_client_secret"/);
  assert.match(service, /status: \{ \$in: \["active", "retiring"\] \}/);
  assert.match(service, /runtimeAvailable: false/);
  assert.match(service, /activationAllowed: false/);
  assert.match(service, /providerAccepted: false/);
});

test("Enterprise SSO readiness requires active verified BusinessDomain ownership", async () => {
  const service = await source(
    "../features/enterpriseSso/enterpriseSsoService.js"
  );

  assert.match(service, /BusinessDomain\.find/);
  assert.match(service, /status: "active"/);
  assert.match(service, /"verification\.verifiedAt": \{ \$ne: null \}/);
  assert.match(service, /domainsVerified/);
  assert.match(service, /ENTERPRISE_SSO_CLIENT_TENANT_FORBIDDEN/);
});

test("Enterprise SSO URLs fail closed and foundation exposes no authentication endpoint", async () => {
  const [service, routes] = await Promise.all([
    source("../features/enterpriseSso/enterpriseSsoService.js"),
    source("../features/enterpriseSso/enterpriseSsoRoutes.js"),
  ]);

  assert.match(service, /url\.protocol !== "https:"/);
  assert.match(service, /url\.username/);
  assert.match(service, /url\.password/);
  assert.match(service, /url\.hash/);
  assert.doesNotMatch(routes, /\/login|\/callback|\/activate|\/enable/);
});
