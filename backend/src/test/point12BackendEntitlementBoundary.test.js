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
