import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPLOYEE_PERMISSIONS,
  hasPermission,
} from "./permissions.js";

test("only Super Admin implicitly has every permission", () => {
  assert.equal(
    hasPermission(
      {
        role: "admin",
        isSuperAdmin: true,
        permissions: [],
      },
      "employee:create"
    ),
    true
  );

  assert.equal(
    hasPermission(
      {
        role: "admin",
        isSuperAdmin: false,
        permissions: [],
      },
      "employee:create"
    ),
    false
  );
});

test("staff require an explicit permission", () => {
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

