import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

function functionSlice(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);

  assert.ok(start >= 0, `Missing function marker: ${startMarker}`);
  assert.ok(end > start, `Missing function end marker: ${endMarker}`);

  return text.slice(start, end);
}

test(
  "staff creation and sign-in privileged roles use request-aware role authority",
  async () => {
    const controller = await source(
      "../controllers/adminUserController.js"
    );

    const enableSignIn = functionSlice(
      controller,
      "export async function enableEmployeeSignIn",
      "export async function updateEmployeeServices"
    );
    const createStaff = functionSlice(
      controller,
      "export async function createStaffUserByAdmin",
      "export function normaliseEmployeeManagementUpdate"
    );

    for (const handler of [
      enableSignIn,
      createStaff,
    ]) {
      assert.match(
        handler,
        /roleDefinition\.superAdminOnly[\s\S]{0,220}hasRequestPermission\(\s*req,\s*"employee:role:update"\s*\)/
      );
      assert.doesNotMatch(
        handler,
        /req\.user\.role\s*!==\s*"super_admin"/
      );
    }
  }
);

test(
  "existing employee settings use canonical role and permission authority",
  async () => {
    const controller = await source(
      "../controllers/adminUserController.js"
    );
    const handler = functionSlice(
      controller,
      "export async function updateEmployeeManagementSettings",
      "export async function updateAdminUserStatus"
    );

    assert.match(
      handler,
      /user\.role ===[\s\S]{0,80}"super_admin"[\s\S]{0,180}hasRequestPermission\(\s*req,\s*"employee:role:update"\s*\)/
    );
    assert.match(
      handler,
      /hasOwnProperty\.call\(\s*update,\s*"role"\s*\)[\s\S]{0,160}hasRequestPermission\(\s*req,\s*"employee:role:update"\s*\)/
    );
    assert.match(
      handler,
      /hasOwnProperty\.call\(\s*update,\s*"permissions"\s*\)[\s\S]{0,160}hasRequestPermission\(\s*req,\s*"employee:permissions:update"\s*\)/
    );
    assert.doesNotMatch(
      handler,
      /req\.user\.role/
    );

    assert.match(
      handler,
      /protectFinalSuperAdmin\(/
    );
  }
);

test(
  "Super Admin status changes require role authority while final-account protections remain",
  async () => {
    const controller = await source(
      "../controllers/adminUserController.js"
    );
    const handler = controller.slice(
      controller.indexOf(
        "export async function updateAdminUserStatus"
      )
    );

    assert.match(
      handler,
      /user\.role === "super_admin"[\s\S]{0,180}hasRequestPermission\(\s*req,\s*"employee:role:update"\s*\)/
    );
    assert.doesNotMatch(
      handler,
      /req\.user\.role\s*!==\s*"super_admin"/
    );
    assert.match(
      handler,
      /activeSuperAdmins\s*=\s*await User\.countDocuments/
    );
    assert.match(
      handler,
      /final active Super Admin account cannot be deactivated/
    );
  }
);

test(
  "employee routes keep their operation-specific canonical guards",
  async () => {
    const routes = await source(
      "../routes/authRoutes.js"
    );

    assert.match(
      routes,
      /"\/admin\/staff-record\/:id\/sign-in"[\s\S]{0,180}requirePermissions\(\s*"employee:create"\s*\)/
    );
    assert.match(
      routes,
      /"\/admin\/staff\/:id"[\s\S]{0,180}requireEmployeeSettingsChanges/
    );
    assert.match(
      routes,
      /"\/admin\/staff\/:id\/status"[\s\S]{0,180}requirePermissions\(\s*"employee:deactivate"\s*\)/
    );
  }
);
