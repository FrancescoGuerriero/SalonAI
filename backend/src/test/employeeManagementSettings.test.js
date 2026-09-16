import assert from "node:assert/strict";
import test from "node:test";

import {
  normaliseEmployeeManagementUpdate,
} from "../controllers/adminUserController.js";

test("employee management accepts independent operational controls", () => {
  assert.deepEqual(
    normaliseEmployeeManagementUpdate({
      role: "manager",
      isActive: true,
      profilePublished: false,
      isBookable: true,
      email: "ignored@example.com",
    }),
    {
      role: "manager",
      isActive: true,
      profilePublished: false,
      isBookable: true,
    }
  );
});

test("employee management rejects invalid roles", () => {
  assert.throws(
    () =>
      normaliseEmployeeManagementUpdate({
        role: "owner",
      }),
    (error) =>
      error.statusCode === 400
  );
});

test("employee management rejects non-boolean switches", () => {
  assert.throws(
    () =>
      normaliseEmployeeManagementUpdate({
        isBookable: "true",
      }),
    (error) =>
      error.statusCode === 400
  );
});

test("employee management requires a supported setting", () => {
  assert.throws(
    () =>
      normaliseEmployeeManagementUpdate({
        biography: "Not managed here",
      }),
    (error) =>
      error.statusCode === 400
  );
});
