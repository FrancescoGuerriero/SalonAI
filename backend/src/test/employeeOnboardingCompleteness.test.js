import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test("Add Employee exposes the dashboard onboarding fields", async () => {
  const modal =
    await source(
      "../../../frontend/src/components/employees/AddEmployeeModal.jsx"
    );

  for (const field of [
    "firstName",
    "lastName",
    "profilePhoto",
    "jobTitle",
    "biography",
    "specialties",
    "email",
    "phone",
    "role",
    "isActive",
    "profilePublished",
    "bookable",
    "services",
    "workingHours",
    "permissions",
  ]) {
    assert.ok(
      modal.includes(
        field
      ),
      `Employee onboarding is missing ${field}`
    );
  }

  assert.match(
    modal,
    /Assign services during onboarding/
  );
  assert.match(
    modal,
    /Configure schedule during onboarding/
  );
  assert.match(
    modal,
    /Initial access permissions/
  );
  assert.match(
    modal,
    /Add break/
  );
});

test("employee onboarding validates service and schedule authority independently from employee:create", async () => {
  const controller =
    await source(
      "../controllers/adminUserController.js"
    );

  assert.match(
    controller,
    /hasServices[\s\S]*?hasUserPermission\(\s*req\.user,\s*"employee:services:update"/s
  );
  assert.match(
    controller,
    /hasWorkingHours[\s\S]*?hasUserPermission\(\s*req\.user,\s*"employee:schedule:update"/s
  );
  assert.match(
    controller,
    /isActive ===[\s\S]*?hasUserPermission\(\s*req\.user,\s*"employee:deactivate"/s
  );
  assert.match(
    controller,
    /Only the Super Admin can assign employee permissions during account creation/
  );
});

test("employee onboarding validates nested data before creating the User", async () => {
  const controller =
    await source(
      "../controllers/adminUserController.js"
    );

  const start =
    controller.indexOf(
      "export async function createStaffUserByAdmin"
    );
  const end =
    controller.indexOf(
      "export function normaliseEmployeeManagementUpdate",
      start
    );

  assert.ok(
    start >= 0 &&
      end >
        start
  );

  const handler =
    controller.slice(
      start,
      end
    );

  const services =
    handler.indexOf(
      "await normaliseServiceIds"
    );
  const schedule =
    handler.indexOf(
      "normaliseEmployeeSchedule("
    );
  const userCreate =
    handler.indexOf(
      "await User.create"
    );

  assert.ok(
    services >= 0 &&
      userCreate >= 0 &&
      services <
        userCreate
  );
  assert.ok(
    schedule >= 0 &&
      schedule <
        userCreate
  );
});

test("failed employee onboarding restores an existing unlinked profile or removes a newly-created profile", async () => {
  const controller =
    await source(
      "../controllers/adminUserController.js"
    );

  assert.match(
    controller,
    /existingStylistBefore\s*=/
  );
  assert.match(
    controller,
    /Stylist\.replaceOne\(/
  );
  assert.match(
    controller,
    /Stylist\.deleteOne\(/
  );
  assert.match(
    controller,
    /User\.deleteOne\(/
  );
});

test("employee creation initialises professional profile and operational state", async () => {
  const controller =
    await source(
      "../controllers/adminUserController.js"
    );

  for (const value of [
    "firstName",
    "lastName",
    "jobTitle",
    "biography",
    "specialties",
    "services",
    "workingHours",
    "profilePublished",
    "bookable",
    "isActive",
  ]) {
    assert.ok(
      controller.includes(
        value
      ),
      `Controller onboarding is missing ${value}`
    );
  }

  assert.match(
    controller,
    /action:\s*"employee\.created"/
  );
  assert.match(
    controller,
    /scheduleConfigured:/
  );
});

test("Employees page uses the canonical onboarding modal", async () => {
  const page =
    await source(
      "../../../frontend/src/pages/AdminStaffAccountsPage.jsx"
    );

  assert.match(
    page,
    /import AddEmployeeModal/
  );
  assert.match(
    page,
    /<AddEmployeeModal/
  );
  assert.doesNotMatch(
    page,
    /Temporary password[\s\S]*Create employee/
  );
});
