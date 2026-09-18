import assert from "node:assert/strict";
import test from "node:test";

import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

function execute(user, ...permissions) {
  const request = {
    user,
    requestId: "test-request",
  };

  let statusCode = 200;
  let payload = null;
  let nextCalled = false;

  const response = {
    status(value) {
      statusCode = value;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };

  requirePermissions(...permissions)(
    request,
    response,
    () => {
      nextCalled = true;
    }
  );

  return {
    statusCode,
    payload,
    nextCalled,
  };
}

test("Super Admin bypasses assigned-permission checks", () => {
  const result = execute(
    {
      role: "admin",
      isSuperAdmin: true,
      permissions: [],
    },
    "appointment:update"
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.payload, null);
});

test("Admin requires delegated appointment permission", () => {
  const denied = execute(
    {
      role: "admin",
      isSuperAdmin: false,
      permissions: [],
    },
    "appointment:update"
  );

  assert.equal(denied.nextCalled, false);
  assert.equal(denied.statusCode, 403);
  assert.deepEqual(
    denied.payload.missingPermissions,
    ["appointment:update"]
  );

  const allowed = execute(
    {
      role: "admin",
      isSuperAdmin: false,
      permissions: ["appointment:update"],
    },
    "appointment:update"
  );

  assert.equal(allowed.nextCalled, true);
});

test("Receptionist can update appointments only when delegated", () => {
  assert.equal(
    execute(
      {
        role: "receptionist",
        permissions: ["appointment:read"],
      },
      "appointment:update"
    ).statusCode,
    403
  );

  assert.equal(
    execute(
      {
        role: "receptionist",
        permissions: [
          "appointment:read",
          "appointment:update",
        ],
      },
      "appointment:update"
    ).nextCalled,
    true
  );
});
