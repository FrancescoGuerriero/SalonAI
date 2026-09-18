import assert from "node:assert/strict";
import test from "node:test";

import AppError from "../errors/AppError.js";
import {
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

test("AppError exposes structured properties", () => {
  const error = new AppError(
    "Forbidden",
    {
      statusCode: 403,
      code: "FORBIDDEN",
    }
  );

  assert.equal(error.statusCode, 403);
  assert.equal(error.code, "FORBIDDEN");
});

test("permission middleware allows Super Admin role", () => {
  const middleware =
    requirePermissions("system.settings.write");

  let nextCalled = false;

  middleware(
    {
      user: {
        role: "super_admin",
        permissions: [],
      },
    },
    responseRecorder(),
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});

test("permission middleware no longer gives Admin an implicit bypass", () => {
  const middleware =
    requirePermissions("system.settings.write");
  const response =
    responseRecorder();
  let nextCalled = false;

  middleware(
    {
      user: {
        role: "admin",
        permissions: [],
      },
    },
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, false);
  assert.equal(
    response.state.statusCode,
    403
  );
});
