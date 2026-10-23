import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import MarketplaceApp from "../models/MarketplaceApp.js";
import MarketplaceInstallation from "../models/MarketplaceInstallation.js";

const BUSINESS_ID = "507f1f77bcf86cd799439021";
const USER_ID = "507f1f77bcf86cd799439024";
const APP_ID = "507f1f77bcf86cd799439025";
const INTEGRATION_APP_ID = "507f1f77bcf86cd799439026";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("marketplace catalogue records reviewed scopes and commercial metadata without billing authority", async () => {
  const app = new MarketplaceApp({
    key: "example-partner",
    name: "Example Partner",
    partnerName: "Example Ltd",
    status: "approved",
    requestedScopes: ["appointments:read"],
    approvedScopes: ["appointments:read"],
    requiredEntitlements: ["integrations"],
    commercialTerms: {
      billingModel: "revenue_share",
      currency: "GBP",
      revenueSharePercent: 10,
    },
    submittedBy: USER_ID,
  });

  await assert.doesNotReject(app.validate());
  assert.equal(app.billingExecutionEnabled, false);
});

test("tenant marketplace installation is preparation evidence only", async () => {
  const installation = new MarketplaceInstallation({
    business: BUSINESS_ID,
    marketplaceApp: APP_ID,
    integrationApp: INTEGRATION_APP_ID,
    status: "prepared",
    grantedScopes: ["appointments:read"],
    entitlementSnapshot: ["integrations"],
    preparedBy: USER_ID,
  });

  await assert.doesNotReject(installation.validate());
  assert.equal(installation.billingExecutionEnabled, false);
  assert.equal(installation.connectionProvisioned, false);
});

test("marketplace submission and review remain platform-governed while tenant installs use trusted authority", async () => {
  const routes = await source(
    "../features/partnerMarketplace/partnerMarketplaceRoutes.js"
  );

  assert.match(routes, /superAdminOnly/);
  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /feature-control:read/);
  assert.match(routes, /feature-control:update/);
  assert.match(routes, /"\/submissions\/:appId\/review"/);
  assert.match(routes, /"\/apps\/:appId\/installations"/);
});

test("marketplace installation reuses TenantSubscription and IntegrationApp without provisioning credentials or connections", async () => {
  const service = await source(
    "../features/partnerMarketplace/partnerMarketplaceService.js"
  );

  assert.match(service, /TenantSubscription\.findOne/);
  assert.match(service, /resolveTenantEntitlements/);
  assert.match(service, /IntegrationApp\.findOneAndUpdate/);
  assert.match(service, /status: "draft"/);
  assert.match(service, /MARKETPLACE_ENTITLEMENTS_REQUIRED/);
  assert.match(service, /billingExecutionEnabled: false/);
  assert.match(service, /connectionProvisioned: false/);
  assert.doesNotMatch(service, /IntegrationConnection\./);
  assert.doesNotMatch(service, /CredentialVersion\./);
});

test("marketplace rejects secrets and is mounted inside the existing integration control plane", async () => {
  const [service, integrationRoutes] = await Promise.all([
    source("../features/partnerMarketplace/partnerMarketplaceService.js"),
    source("../features/integrationPlatform/integrationPlatformRoutes.js"),
  ]);

  assert.match(service, /MARKETPLACE_SECRET_INPUT_PROHIBITED/);
  assert.match(service, /MARKETPLACE_CLIENT_TENANT_FORBIDDEN/);
  assert.match(integrationRoutes, /partnerMarketplaceRoutes/);
  assert.match(integrationRoutes, /"\/marketplace"/);
});
