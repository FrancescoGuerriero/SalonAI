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

test("User role model includes super_admin", () => {
  const values =
    User.schema.path("role").enumValues;

  assert.ok(values.includes("super_admin"));
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

test("Stylist baseline is limited to appointment view/create", () => {
  const baseline =
    STAFF_ROLE_BASELINE_PERMISSIONS.stylist;

  assert.deepEqual(
    baseline,
    [
      "appointment:read",
      "appointment:create",
    ]
  );

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
      permissionsForRole(
        "stylist",
        []
      ).includes(
        permission
      ),
      false,
      `Stylist baseline must not include ${permission}`
    );
  }
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
