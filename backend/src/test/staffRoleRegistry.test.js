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
    normaliseRoleKey(
      "Colour Specialist"
    ),
    "colour_specialist"
  );

  assert.throws(
    () =>
      assertCustomRoleKey(
        "super_admin"
      ),
    (error) =>
      error.statusCode === 409
  );

  assert.equal(
    assertCustomRoleKey(
      "colour_specialist"
    ),
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
    [
      "service:read",
      "appointment:read",
    ]
  );

  assert.throws(
    () =>
      normaliseRolePermissions([
        "system:root",
      ]),
    (error) =>
      error.statusCode === 400
  );
});

test("built-in staff roles retain their protected semantics", () => {
  const superAdmin =
    builtInRoleDefinition(
      "super_admin"
    );
  const stylist =
    builtInRoleDefinition(
      "stylist"
    );

  assert.equal(
    superAdmin.assignable,
    false
  );
  assert.equal(
    superAdmin.system,
    true
  );
  assert.equal(
    stylist.assignable,
    true
  );
  assert.deepEqual(
    stylist.permissions,
    [
      "appointment:read",
      "appointment:create",
    ]
  );
});

test("any non-customer role key is treated as a potential staff account", () => {
  assert.equal(
    isPotentialStaffRole(
      "colour_specialist"
    ),
    true
  );
  assert.equal(
    isPotentialStaffRole(
      "customer"
    ),
    false
  );
});

test("employee management resolves custom role assignments through the registry", async () => {
  const controller =
    await readFile(
      new URL(
        "../controllers/adminUserController.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    controller,
    /resolveStaffRole/
  );
  assert.match(
    controller,
    /roleDefinition\.system ===\s*false/
  );
  assert.match(
    controller,
    /Permissions for a custom role are managed from the role registry/
  );
  assert.match(
    controller,
    /\$ne:\s*"customer"/
  );
});

test("custom staff roles use the management shell but not legacy blanket backend access", async () => {
  const backendGuard =
    await readFile(
      new URL(
        "../middleware/authMiddleware.js",
        import.meta.url
      ),
      "utf8"
    );

  const futureRoutes =
    await readFile(
      new URL(
        "../features/futureFeatureRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  const frontendRoles =
    await readFile(
      new URL(
        "../../../frontend/src/utils/roles.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    backendGuard,
    /export const managementOnly = authorize\(/
  );
  assert.match(
    backendGuard,
    /"super_admin"/
  );
  assert.match(
    frontendRoles,
    /normalised !== "customer"/
  );

  const appointmentIndex =
    futureRoutes.indexOf(
      '"/appointment-management"'
    );
  const staffIndex =
    futureRoutes.indexOf(
      '"/staff"'
    );
  const legacyGateIndex =
    futureRoutes.indexOf(
      "router.use(managementOnly)"
    );

  assert.ok(
    appointmentIndex >= 0 &&
    appointmentIndex <
      legacyGateIndex
  );
  assert.ok(
    staffIndex >= 0 &&
    staffIndex <
      legacyGateIndex
  );
});

test("staff role management is audited and synchronises assigned employees", async () => {
  const controller =
    await readFile(
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

  assert.match(
    controller,
    /User\.updateMany/
  );
  assert.match(
    controller,
    /assignedEmployeesUpdated/
  );
});
