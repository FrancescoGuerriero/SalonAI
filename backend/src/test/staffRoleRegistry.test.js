import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertCustomRoleKey,
  builtInRoleDefinition,
  isPotentialStaffRole,
  normaliseRoleKey,
  normaliseRolePermissions,
} from "../services/staffRoleRegistryService.js";

test("custom staff role keys are normalised and protected from reserved names", () => {
  assert.equal(
    normaliseRoleKey("Colour Specialist"),
    "colour_specialist"
  );

  assert.throws(
    () => assertCustomRoleKey("super_admin"),
    (error) => error.statusCode === 409
  );

  assert.equal(
    assertCustomRoleKey("colour_specialist"),
    "colour_specialist"
  );
});

test("custom role permissions are limited to the canonical catalogue", () => {
  assert.deepEqual(
    normaliseRolePermissions([
      "service:read",
      "service:read",
      "appointment:read",
    ]),
    ["service:read", "appointment:read"]
  );

  assert.throws(
    () => normaliseRolePermissions(["system:root"]),
    (error) => error.statusCode === 400
  );

  for (const reserved of [
    "employee:role:update",
    "employee:permissions:update",
  ]) {
    assert.throws(
      () =>
        normaliseRolePermissions([
          "employee:read",
          reserved,
        ]),
      (error) => error.statusCode === 400
    );
  }
});

test("built-in staff roles retain their protected semantics", () => {
  const superAdmin = builtInRoleDefinition("super_admin");
  const stylist = builtInRoleDefinition("stylist");

  assert.equal(superAdmin.assignable, false);
  assert.equal(superAdmin.system, true);
  assert.equal(stylist.assignable, true);
  assert.equal(superAdmin.editable, false);
  assert.equal(stylist.editable, true);
  assert.deepEqual(stylist.permissions, ["dashboard:view"]);
});

test("any non-customer role key is treated as a potential staff account", () => {
  assert.equal(isPotentialStaffRole("colour_specialist"), true);
  assert.equal(isPotentialStaffRole("customer"), false);
});

test("employee management resolves custom role assignments through the registry", async () => {
  const controller = await readFile(
    new URL(
      "../controllers/adminUserController.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(controller, /resolveStaffRole/);
  assert.match(controller, /roleDefinition\.system ===\s*false/);
  assert.match(controller, /rolePermissions/);
  assert.match(controller, /\$ne:\s*"customer"/);
});

test("dashboard workspaces use granular backend permissions instead of blanket management access", async () => {
  const futureRoutes = await readFile(
    new URL(
      "../features/futureFeatureRoutes.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(futureRoutes, /requirePermissions/);
  assert.doesNotMatch(futureRoutes, /router\.use\(managementOnly\);/);

  for (const permission of [
    "communications:read",
    "customer:read",
    "appointment:read",
    "ai:use",
    "reports:read",
    "inventory:read",
    "loyalty:manage",
  ]) {
    assert.match(
      futureRoutes,
      new RegExp(
        permission.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        )
      )
    );
  }

  assert.match(
    futureRoutes,
    /"\/security",[\s\S]*securityRoutes/
  );
  assert.doesNotMatch(
    futureRoutes,
    /"\/security",[\s\S]*managementOnly/
  );
});

test("staff role management is audited and tenant-scoped without global User permission propagation", async () => {
  const controller = await readFile(
    new URL(
      "../controllers/staffRoleController.js",
      import.meta.url
    ),
    "utf8"
  );

  for (const action of [
    "staff_role.created",
    "staff_role.updated",
    "staff_role.deleted",
  ]) {
    assert.match(
      controller,
      new RegExp(action.replace(".", "\\."))
    );
  }

  assert.match(controller, /listTenantStaffRoleDefinitions/);
  assert.match(controller, /resolveTenantStaffRole/);
  assert.match(controller, /trustedStaffRoleBusinessFilter/);
  assert.match(controller, /BusinessMembership\.countDocuments/);
  assert.match(controller, /assignedEmployeesAffected/);
  assert.match(controller, /assignedEmployeesUpdated:\s*0/);
  assert.doesNotMatch(controller, /User\.updateMany/);
  assert.doesNotMatch(controller, /StaffRole\.findById/);
});

test("staff role routes attach trusted tenant authority before granular role permissions", async () => {
  const routes = await readFile(
    new URL(
      "../routes/staffRoleRoutes.js",
      import.meta.url
    ),
    "utf8"
  );

  for (const permission of [
    "staff-role:read",
    "staff-role:create",
    "staff-role:update",
    "staff-role:activate",
    "staff-role:delete",
  ]) {
    assert.match(
      routes,
      new RegExp(
        permission.replace("-", "\\-")
      )
    );
  }

  assert.match(
    routes,
    /const staffRoleTenantChain = \[\s*protect,\s*workforcePublicTenantContextMiddleware,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*\];/
  );
  assert.match(routes, /\.\.\.staffRoleTenantChain/);
  assert.doesNotMatch(routes, /superAdminOnly/);
});

test("employee special permissions remain independent from custom role templates", async () => {
  const controller = await readFile(
    new URL(
      "../controllers/adminUserController.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(controller, /rolePermissions/);
  assert.doesNotMatch(
    controller,
    /Permissions for a custom role are managed from the role registry/
  );
});

test("built-in role profiles are editable without exposing system identity mutation", async () => {
  const controller = await readFile(
    new URL(
      "../controllers/staffRoleController.js",
      import.meta.url
    ),
    "utf8"
  );

  const page = await readFile(
    new URL(
      "../../../frontend/src/pages/StaffRoleManagementPage.jsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(controller, /Built-in staff role updated/);
  assert.match(controller, /Built-in role keys are protected/);
  assert.match(controller, /Built-in roles cannot be deactivated/);
  assert.match(controller, /rolePermissions/);

  assert.match(page, /Save role permissions/);
  assert.match(page, /baselinePermissions/);
  assert.match(page, /Required/);
});

test("customer APIs rely on granular customer permissions without a blanket management role gate", async () => {
  const routes = await readFile(
    new URL(
      "../routes/customerRoutes.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(routes, /requirePermissions/);
  assert.doesNotMatch(routes, /managementOnly/);

  for (const permission of [
    "customer:read",
    "customer:create",
    "customer:update",
    "customer:archive",
    "customer:delete",
  ]) {
    assert.match(
      routes,
      new RegExp(
        permission.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        )
      )
    );
  }
});

test(
  "staff role mutation guard is request-aware for tenant authority",
  async () => {
    const routes = await readFile(
      new URL(
        "../routes/staffRoleRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(routes, /hasRequestPermission/);
    assert.match(
      routes,
      /hasRequestPermission\(\s*req,\s*permission\s*\)/
    );
    assert.doesNotMatch(routes, /hasUserPermission/);
  }
);

test(
  "effective authority resolves roles through the Business-aware tenant registry by default",
  async () => {
    const service = await readFile(
      new URL(
        "../services/effectiveAuthorityService.js",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(service, /resolveTenantStaffRole/);
    assert.match(
      service,
      /roleResolver\s*=\s*resolveTenantStaffRole/
    );
    assert.doesNotMatch(
      service,
      /roleResolver\s*=\s*resolveStaffRole/
    );
  }
);
