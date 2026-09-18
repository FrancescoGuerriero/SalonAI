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

test("Stylist baseline preserves appointment and own-profile access", () => {
  const stylist = {
    role: "stylist",
    permissions: [],
  };

  for (const permission of [
    "appointment:read",
    "appointment:create",
    "profile:own:read",
    "profile:own:update",
  ]) {
    assert.equal(
      hasPermission(
        stylist,
        permission
      ),
      true
    );
  }

  assert.equal(
    hasPermission(
      stylist,
      "employee:update"
    ),
    false
  );

  assert.ok(
    effectivePermissions(
      stylist
    ).includes(
      "appointment:create"
    )
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
