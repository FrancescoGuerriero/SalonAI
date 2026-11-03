import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("CRM lead APIs establish trusted tenant and Location authority before entitlement and RBAC", async () => {
  const routes = await source("../features/leads/leadRoutes.js");
  const chainStart = routes.indexOf("router.use(");
  const chainEnd = routes.indexOf(");", chainStart);
  const chain = routes.slice(chainStart, chainEnd);

  assert.ok(chainStart >= 0);
  assert.match(
    chain,
    /workforcePublicTenantContextMiddleware[\s\S]*trustedTenantContextMiddleware[\s\S]*effectiveAuthorityMiddleware[\s\S]*requireCommercialModule\("crm"\)/
  );

  assert.match(routes, /requirePermissions\("customer:read"\)/);
  assert.match(routes, /requirePermissions\("customer:update"\)/);
  assert.match(routes, /requirePermissions\("customer:create"\)/);
  assert.match(routes, /requirePermissions\("communications:manage"\)/);
});

test("CRM lead controller keeps Business and Location scope authoritative", async () => {
  const controller = await source("../features/leads/leadController.js");

  assert.match(controller, /request\.effectiveAuthority\?\.businessId/);
  assert.match(controller, /request\.effectiveAuthority\?\.locationId/);
  assert.match(controller, /LOCATION_REQUIRED/);
  assert.match(controller, /listLeads\(request\.query \|\| \{\}, authority\(request\)\)/);
  assert.match(controller, /getLeadAggregate\(request\.params\.leadId, authority\(request\)\)/);
  assert.match(controller, /convertLeadToCustomer\([\s\S]*authority\(request\)/);
});
