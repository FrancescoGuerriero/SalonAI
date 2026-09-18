import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPLOYEE_PERMISSIONS,
  effectivePermissions,
  hasPermission,
} from "./permissions.js";

test("Super Admin implicitly has every permission", () => {
  assert.equal(
    hasPermission(
      {
        role: "super_admin",
        permissions: [],
      },
      "employee:create"
    ),
    true
  );
});

test("Administrator requires delegated permissions", () => {
  const admin = {
    role: "admin",
    permissions: [
      "employee:read",
    ],
  };

  assert.equal(
    hasPermission(
      admin,
      "employee:read"
    ),
    true
  );

  assert.equal(
    hasPermission(
      admin,
      "employee:create"
    ),
    false
  );
});

test("staff require an explicit permission outside role baseline", () => {
  const manager = {
    role: "manager",
    permissions: [
      "employee:read",
    ],
  };

  assert.equal(
    hasPermission(
      manager,
      "employee:read"
    ),
    true
  );
  assert.equal(
    hasPermission(
      manager,
      "employee:create"
    ),
    false
  );
});

test("Stylist baseline is limited to appointment view/create", () => {
  const stylist = {
    role: "stylist",
    permissions: [],
  };

  for (const permission of [
    "appointment:read",
    "appointment:create",
  ]) {
    assert.equal(
      hasPermission(
        stylist,
        permission
      ),
      true
    );
  }

  for (const permission of [
    "dashboard:view",
    "profile:own:read",
    "profile:own:update",
    "schedule:own:read",
    "schedule:own:update",
    "leave:own:request",
    "employee:update",
  ]) {
    assert.equal(
      hasPermission(
        stylist,
        permission
      ),
      false
    );
  }

  assert.deepEqual(
    effectivePermissions(
      stylist
    ),
    [
      "appointment:read",
      "appointment:create",
    ]
  );
});

test("employee permission catalogue is unique", () => {
  const values =
    EMPLOYEE_PERMISSIONS.map(
      (permission) =>
        permission.value
    );

  assert.equal(
    new Set(values).size,
    values.length
  );
});
