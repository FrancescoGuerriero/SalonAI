import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSIGNABLE_EMPLOYEE_PERMISSIONS,
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

test("non-admin staff baseline contains dashboard access only", () => {
  for (const role of [
    "stylist",
    "manager",
    "receptionist",
  ]) {
    const user = {
      role,
      permissions: [],
    };

    assert.deepEqual(
      effectivePermissions(
        user
      ),
      [
        "dashboard:view",
      ]
    );

    assert.equal(
      hasPermission(
        user,
        "dashboard:view"
      ),
      true
    );

    assert.equal(
      hasPermission(
        user,
        "customer:read"
      ),
      false
    );
  }
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


test("custom role templates and employee special permissions combine", () => {
  const colourSpecialist = {
    role: "colour_specialist",
    rolePermissions: [
      "service:read",
    ],
    permissions: [
      "profile:own:read",
    ],
  };

  assert.equal(
    hasPermission(
      colourSpecialist,
      "service:read"
    ),
    true
  );
  assert.equal(
    hasPermission(
      colourSpecialist,
      "appointment:create"
    ),
    false
  );
});


test("Admin can govern staff permissions and roles while subordinate staff require grants", () => {
  for (const permission of [
    "staff-role:read",
    "staff-role:create",
    "staff-role:update",
    "staff-role:activate",
    "employee:permissions:update",
  ]) {
    assert.equal(
      hasPermission(
        {
          role:
            "admin",
          permissions: [],
        },
        permission
      ),
      true
    );
  }

  for (const role of [
    "receptionist",
    "manager",
    "stylist",
  ]) {
    assert.equal(
      hasPermission(
        {
          role,
          permissions: [],
        },
        "staff-role:update"
      ),
      false
    );
  }

  assert.equal(
    hasPermission(
      {
        role:
          "admin",
        permissions: [],
      },
      "staff-role:delete"
    ),
    false
  );
});


test("role and permission mutation authority is reserved from assignable grants", () => {
  const assignable =
    new Set(
      ASSIGNABLE_EMPLOYEE_PERMISSIONS.map(
        ({ value }) => value
      )
    );

  for (const reserved of [
    "employee:role:update",
    "employee:permissions:update",
  ]) {
    assert.equal(
      assignable.has(
        reserved
      ),
      false
    );
    assert.equal(
      EMPLOYEE_PERMISSIONS.some(
        ({ value }) =>
          value === reserved
      ),
      true
    );
  }
});
