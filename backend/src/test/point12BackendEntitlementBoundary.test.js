import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createCommercialModuleEntitlementMiddleware,
} from "../middleware/commercialModuleEntitlementMiddleware.js";

const BUSINESS_ID = "507f1f77bcf86cd799439012";

function authority() {
  return {
    userId: "507f1f77bcf86cd799439011",
    roleKey: "manager",
    permissions: ["service:read"],
    businessId: BUSINESS_ID,
    locationId: null,
    locationAccessMode: "all",
    allowedLocationIds: null,
  };
}

function composition({ enabled = true } = {}) {
  return {
    manifest: {
      businessId: BUSINESS_ID,
      verticalId: "salon",
      manifestRevision: "7",
    },
    capabilities: [
      {
        key: "services",
        enabled,
        reason: enabled ? "selected" : "not-selected",
      },
    ],
  };
}

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

function invoke(middleware, request) {
  return new Promise((resolve) => {
    middleware(request, {}, (error) => resolve(error || null));
  });
}

test("commercial module entitlement middleware grants an installed module within effective Business authority", async () => {
  const requireCommercialModule = createCommercialModuleEntitlementMiddleware({
    compositionLoader: async (businessId) => {
      assert.equal(businessId, BUSINESS_ID);
      return composition();
    },
  });
  const request = {
    effectiveAuthority: authority(),
  };

  const error = await invoke(requireCommercialModule("services"), request);

  assert.equal(error, null);
  assert.deepEqual(request.commercialModuleEntitlement, {
    moduleKey: "services",
    businessId: BUSINESS_ID,
    manifestRevision: "7",
    verticalId: "salon",
    source: "selected",
  });
});

test("commercial module entitlement middleware fails closed when effective Business authority is missing", async () => {
  const requireCommercialModule = createCommercialModuleEntitlementMiddleware({
    compositionLoader: async () => composition(),
  });

  const error = await invoke(requireCommercialModule("services"), {});

  assert.equal(error?.code, "COMMERCIAL_MODULE_AUTHORITY_REQUIRED");
  assert.equal(error?.statusCode, 500);
});

test("commercial module entitlement middleware fails closed when no active tenant manifest exists", async () => {
  const requireCommercialModule = createCommercialModuleEntitlementMiddleware({
    compositionLoader: async () => null,
  });

  const error = await invoke(
    requireCommercialModule("services"),
    { effectiveAuthority: authority() }
  );

  assert.equal(error?.code, "COMMERCIAL_MODULE_NOT_PROVISIONED");
  assert.equal(error?.statusCode, 404);
});

test("commercial module entitlement middleware fails closed when the module is not enabled", async () => {
  const requireCommercialModule = createCommercialModuleEntitlementMiddleware({
    compositionLoader: async () => composition({ enabled: false }),
  });

  const error = await invoke(
    requireCommercialModule("services"),
    { effectiveAuthority: authority() }
  );

  assert.equal(error?.code, "CAPABILITY_UNAVAILABLE");
  assert.equal(error?.statusCode, 404);
});

test("Services management APIs compose trusted tenant authority, entitlement and RBAC in that order", async () => {
  const routes = await source("../routes/serviceRoutes.js");
  const chainStart = routes.indexOf("const protectedServiceTenantChain");
  const chainEnd = routes.indexOf("];", chainStart);
  const chain = routes.slice(chainStart, chainEnd);

  assert.ok(chainStart >= 0);
  assert.match(chain, /protect[\s\S]*servicePublicTenantContextMiddleware[\s\S]*trustedTenantContextMiddleware[\s\S]*effectiveAuthorityMiddleware[\s\S]*requireCommercialModule\("services"\)/);
  assert.match(routes, /"\/management"[\s\S]*\.\.\.protectedServiceTenantChain[\s\S]*requirePermissions\([\s\S]*"service:read"/);
  assert.match(routes, /router\.post\([\s\S]*\.\.\.protectedServiceTenantChain[\s\S]*"service:create"/);
  assert.match(routes, /router\.put\([\s\S]*\.\.\.protectedServiceTenantChain[\s\S]*"service:update"/);
  assert.match(routes, /router\.delete\([\s\S]*\.\.\.protectedServiceTenantChain[\s\S]*"service:delete"/);
});

test("Analytics report APIs enforce commercial entitlement after trusted tenant authority", async () => {
  const routes = await source("../features/reports/reportRoutes.js");
  const routerUseStart = routes.indexOf("router.use(");
  const routerUseEnd = routes.indexOf(");", routerUseStart);
  const chain = routes.slice(routerUseStart, routerUseEnd);

  assert.ok(routerUseStart >= 0);
  assert.match(chain, /workforcePublicTenantContextMiddleware[\s\S]*trustedTenantContextMiddleware[\s\S]*effectiveAuthorityMiddleware[\s\S]*requireCommercialModule\("analytics"\)/);
  assert.match(routes, /requirePermissions\("data-export:manage"\)/);
});

test("Seller Marketplace tenant APIs require commercial entitlement in addition to RBAC", async () => {
  const routes = await source("../features/partnerMarketplace/partnerMarketplaceRoutes.js");
  const tenantStart = routes.indexOf("const tenant = Router();");
  const tenantRoutes = routes.slice(tenantStart);

  assert.ok(tenantStart >= 0);
  assert.match(
    tenantRoutes,
    /tenant\.use\(trustedTenantContextMiddleware\);[\s\S]*tenant\.use\(effectiveAuthorityMiddleware\);[\s\S]*tenant\.use\(requireCommercialModule\("seller-marketplace"\)\);/
  );
  assert.match(
    tenantRoutes,
    /"\/installations"[\s\S]*requirePermissions\("feature-control:read"\)/
  );
  assert.match(
    tenantRoutes,
    /"\/apps\/:appId\/installations"[\s\S]*requirePermissions\("feature-control:update"\)/
  );
  assert.match(
    tenantRoutes,
    /"\/installations\/:installationId\/reconcile"[\s\S]*requirePermissions\("feature-control:update"\)/
  );

  const catalogueStart = routes.indexOf('"/catalogue"');
  const tenantBoundaryStart = routes.indexOf("const tenant = Router();");
  assert.ok(catalogueStart >= 0 && catalogueStart < tenantBoundaryStart);
});

test("Managed Data Connections require Seller Marketplace entitlement before RBAC", async () => {
  const routes = await source("../features/integrationPlatform/marketingConnectedAccountsRoutes.js");
  const chainStart = routes.indexOf("const dataConnectionTenantChain");
  const chainEnd = routes.indexOf("];", chainStart);
  const chain = routes.slice(chainStart, chainEnd);

  assert.ok(chainStart >= 0);
  assert.match(
    chain,
    /trustedTenantContextMiddleware[\s\S]*effectiveAuthorityMiddleware[\s\S]*requireCommercialModule\("seller-marketplace"\)/
  );
  assert.match(
    routes,
    /"\/data-connections\/catalogue"[\s\S]*\.\.\.dataConnectionTenantChain[\s\S]*read/
  );
  assert.match(
    routes,
    /"\/data-connections\/:connector\/authorize"[\s\S]*\.\.\.dataConnectionTenantChain[\s\S]*write/
  );
  assert.match(
    routes,
    /"\/data-connections\/:connector\/import"[\s\S]*\.\.\.dataConnectionTenantChain[\s\S]*write/
  );
  assert.match(
    routes,
    /"\/data-connections\/:connector\/seller-kpis"[\s\S]*\.\.\.dataConnectionTenantChain[\s\S]*read/
  );
});

test("staff-facing Communications APIs require commercial entitlement before operation RBAC", async () => {
  for (const relativePath of [
    "../routes/communicationCampaignRoutes.js",
    "../routes/communicationTemplateRoutes.js",
    "../routes/scheduledCommunicationRoutes.js",
    "../routes/messageDeliveryRoutes.js",
  ]) {
    const routes = await source(relativePath);
    const chainStart = routes.indexOf("router.use(");
    const chainEnd = routes.indexOf(");", chainStart);
    const chain = routes.slice(chainStart, chainEnd);

    assert.ok(chainStart >= 0, `${relativePath} must expose a staff middleware chain`);
    assert.match(
      chain,
      /protect[\s\S]*workforcePublicTenantContextMiddleware[\s\S]*trustedTenantContextMiddleware[\s\S]*effectiveAuthorityMiddleware[\s\S]*requireCommercialModule\("communications"\)[\s\S]*communicationEffectiveScopeMiddleware/,
      `${relativePath} must enforce Communications entitlement after effective authority`
    );
    assert.match(routes, /communications:read/);
    assert.match(routes, /communications:manage/);
  }
});

test("Twilio provider webhook remains outside staff Communications entitlement", async () => {
  const routes = await source("../routes/messageDeliveryRoutes.js");
  const webhookStart = routes.indexOf('"/webhooks/twilio/status"');
  const staffChainStart = routes.indexOf("router.use(", webhookStart);
  const webhookSlice = routes.slice(webhookStart, staffChainStart);

  assert.ok(webhookStart >= 0 && staffChainStart > webhookStart);
  assert.match(webhookSlice, /twilioWebhookProtection/);
  assert.doesNotMatch(webhookSlice, /protect|effectiveAuthorityMiddleware|requireCommercialModule/);
});

test("shared Connections workspace remains permission-gated and outside Seller Marketplace entitlement", async () => {
  const app = await source("../../../frontend/src/App.jsx");
  const routeStart = app.indexOf('path="admin/system/connections"');
  const routeEnd = app.indexOf("/>", routeStart);
  const route = app.slice(routeStart, routeEnd + 2);

  assert.ok(routeStart >= 0);
  assert.match(
    route,
    /permissionPage\(ConnectionsWorkspacePage, "feature-control:read"\)/
  );
  assert.doesNotMatch(route, /seller-marketplace|CommercialModuleEntitlementBoundary/);
});
