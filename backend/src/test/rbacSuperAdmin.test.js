import assert from "node:assert/strict";
import test from "node:test";

import User from "../models/user.js";
import {
  EMPLOYEE_PERMISSION_SET,
  STAFF_ROLE_BASELINE_PERMISSIONS,
  permissionsForRole,
} from "../constants/permissions.js";
import {
  hasUserPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  builtInRoleDefinition,
} from "../services/staffRoleRegistryService.js";

function responseRecorder() {
  const state = {
    statusCode: 200,
    body: null,
  };

  return {
    state,
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    },
  };
}

test("User role model supports governed custom keys while Super Admin remains built in", () => {
  const customUser =
    new User({
      name:
        "Colour Specialist",
      email:
        "colour@example.com",
      password:
        "password123",
      role:
        "colour_specialist",
    });

  assert.equal(
    customUser.validateSync(),
    undefined
  );

  const invalidUser =
    new User({
      name:
        "Invalid Role",
      email:
        "invalid@example.com",
      password:
        "password123",
      role:
        "Owner Role!",
    });

  assert.ok(
    invalidUser.validateSync()
      ?.errors?.role
  );

  const superAdmin =
    builtInRoleDefinition(
      "super_admin"
    );

  assert.equal(
    superAdmin?.system,
    true
  );
  assert.equal(
    superAdmin?.assignable,
    false
  );
});

test("Super Admin receives the only unconditional permission bypass", () => {
  assert.equal(
    hasUserPermission(
      { role: "super_admin", permissions: [] },
      "feature-control:update"
    ),
    true
  );

  assert.equal(
    hasUserPermission(
      { role: "admin", permissions: [] },
      "feature-control:update"
    ),
    false
  );
});

test("Admin retains management authority while other staff require explicit grants", () => {
  for (const permission of [
    "dashboard:view",
    "appointment:read",
    "customer:read",
    "employee:read",
    "employee:permissions:update",
    "service:read",
    "product:read",
    "communications:read",
    "inventory:read",
    "reports:read",
    "ai:use",
    "staff-role:read",
    "staff-role:create",
    "staff-role:update",
    "staff-role:activate",
  ]) {
    assert.equal(
      STAFF_ROLE_BASELINE_PERMISSIONS
        .admin
        .includes(
          permission
        ),
      true,
      `Admin baseline is missing ${permission}`
    );
  }

  for (const role of [
    "receptionist",
    "manager",
    "stylist",
  ]) {
    assert.deepEqual(
      STAFF_ROLE_BASELINE_PERMISSIONS[
        role
      ],
      [
        "dashboard:view",
      ]
    );
  }
});

test("Role-template and employee-specific permissions are additive", () => {
  assert.equal(
    hasUserPermission(
      {
        role:
          "colour_specialist",
        rolePermissions: [
          "service:read",
        ],
        permissions: [
          "customer:read",
        ],
      },
      "service:read"
    ),
    true
  );

  assert.equal(
    hasUserPermission(
      {
        role:
          "colour_specialist",
        rolePermissions: [
          "service:read",
        ],
        permissions: [
          "customer:read",
        ],
      },
      "customer:read"
    ),
    true
  );
});

test("Assigned permissions extend subordinate role capability", () => {
  assert.equal(
    hasUserPermission(
      {
        role: "receptionist",
        permissions: ["customer:read"],
      },
      "customer:read"
    ),
    true
  );

  assert.equal(
    hasUserPermission(
      {
        role: "receptionist",
        permissions: ["customer:read"],
      },
      "customer:update"
    ),
    false
  );
});

test("Permission middleware denies Admin without delegated capability", () => {
  const middleware =
    requirePermissions("product:publish");

  const req = {
    user: {
      role: "admin",
      permissions: [],
    },
    requestId: "rbac-test",
  };

  const res = responseRecorder();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.state.statusCode, 403);
  assert.equal(
    res.state.body.code,
    "INSUFFICIENT_PERMISSIONS"
  );
});

test("Permission middleware allows Super Admin and delegated staff", () => {
  const middleware =
    requirePermissions("product:update");

  for (const user of [
    {
      role: "super_admin",
      permissions: [],
    },
    {
      role: "admin",
      permissions: ["product:update"],
    },
  ]) {
    const res = responseRecorder();
    let nextCalled = false;

    middleware(
      {
        user,
        requestId: "rbac-pass",
      },
      res,
      () => {
        nextCalled = true;
      }
    );

    assert.equal(nextCalled, true);
    assert.equal(res.state.body, null);
  }
});

test("expanded catalogue contains management permissions required by the new model", () => {
  for (const permission of [
    "employee:permissions:update",
    "staff-role:read",
    "staff-role:create",
    "staff-role:update",
    "staff-role:activate",
    "staff-role:delete",
    "profile:all:update",
    "schedule:own:read",
    "schedule:own:update",
    "leave:own:request",
    "service:publish",
    "product:publish",
    "feature-control:update",
  ]) {
    assert.ok(
      EMPLOYEE_PERMISSION_SET.has(permission),
      `Missing permission: ${permission}`
    );
  }
});
