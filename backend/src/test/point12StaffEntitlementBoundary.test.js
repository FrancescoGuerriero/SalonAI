import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Staff APIs enforce trusted tenant authority and commercial entitlement before operation RBAC", async () => {
  const routes = await source("../features/staff/staffRoutes.js");
  const chainStart = routes.indexOf("const workforceTenantAuthority");
  const chainEnd = routes.indexOf("];", chainStart);
  const chain = routes.slice(chainStart, chainEnd);

  assert.ok(chainStart >= 0);
  assert.match(
    chain,
    /workforcePublicTenantContextMiddleware[\s\S]*trustedTenantContextMiddleware[\s\S]*effectiveAuthorityMiddleware[\s\S]*requireCommercialModule\("staff"\)/
  );

  for (const permission of [
    "schedule:own:read",
    "schedule:own:update",
    "leave:own:request",
    "employee:read",
    "employee:schedule:update",
    "appointment:read",
  ]) {
    assert.match(routes, new RegExp(permission.replaceAll(":", "\\:")));
  }
});

test("Staff entitlement covers both self-service and management workforce routes", async () => {
  const routes = await source("../features/staff/staffRoutes.js");

  for (const route of [
    '"/me/availability"',
    '"/me/day"',
    '"/me/time-off"',
    '"/time-off"',
    '"/calendar-blocks"',
    '"/:staffId/availability"',
    '"/:staffId/day"',
    '"/:staffId/time-off"',
    '"/:staffId/calendar-blocks"',
  ]) {
    const routeIndex = routes.indexOf(route);
    assert.ok(routeIndex >= 0, `${route} must remain exposed`);

    const following = routes.slice(routeIndex, routeIndex + 420);
    assert.match(
      following,
      /\.\.\.workforceTenantAuthority/,
      `${route} must pass through the Staff entitlement chain`
    );
  }
});

test("Staff rota APIs enforce Staff entitlement before rota RBAC and scoped mutations", async () => {
  const routes = await source("../features/staffRota/staffRotaRoutes.js");
  const chainStart = routes.indexOf("const rotaTenantAuthority");
  const chainEnd = routes.indexOf("];", chainStart);
  const chain = routes.slice(chainStart, chainEnd);

  assert.ok(chainStart >= 0);
  assert.match(
    chain,
    /workforcePublicTenantContextMiddleware[\s\S]*trustedTenantContextMiddleware[\s\S]*effectiveAuthorityMiddleware[\s\S]*requireCommercialModule\("staff"\)/
  );
  assert.match(routes, /requirePermissions\("employee:schedule:update"\)/);
  assert.match(routes, /requirePermissions\("appointment:read"\)/);
  assert.match(
    routes,
    /\.\.\.rotaTenantAuthority[\s\S]*manageRota[\s\S]*asyncHandler\(requireScopedRotaShiftMutation\)/
  );

  const controller = await source("../features/staffRota/staffRotaController.js");
  assert.match(controller, /request\.effectiveAuthority/);
});
