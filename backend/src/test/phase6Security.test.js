import assert from "node:assert/strict";
import test from "node:test";
import AppError from "../errors/AppError.js";
import { requirePermissions } from "../middleware/permissionMiddleware.js";

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

test("permission middleware allows admin role", async () => {
  const middleware =
    requirePermissions("system.settings.write");

  const req = {
    user: {
      role: "admin",
      permissions: [],
    },
  };

  let nextCalled = false;

  middleware(
    req,
    {},
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});
