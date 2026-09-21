import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildAdminWorkforceRoster,
  normaliseEmployeeManagementUpdate,
  normaliseEmployeeSchedule,
  normaliseEmployeeSignInRequest,
} from "../controllers/adminUserController.js";
import {
  permissionsForRole,
} from "../constants/permissions.js";

test("employee management accepts independent operational controls", () => {
  assert.deepEqual(
    normaliseEmployeeManagementUpdate({
      role: "manager",
      profilePublished: false,
      acceptsAppointments: true,
      permissions: [
        "employee:read",
        "employee:update",
        "employee:read",
      ],
      email: "ignored@example.com",
    }),
    {
      role: "manager",
      profilePublished: false,
      acceptsAppointments: true,
      permissions: [
        "employee:read",
        "employee:update",
      ],
    }
  );
});

test("employee management rejects invalid roles", () => {
  assert.throws(
    () =>
      normaliseEmployeeManagementUpdate({
        role: "Owner Role!",
      }),
    (error) =>
      error.statusCode === 400
  );
});

test("employee management rejects non-boolean switches", () => {
  assert.throws(
    () =>
      normaliseEmployeeManagementUpdate({
        acceptsAppointments: "true",
      }),
    (error) =>
      error.statusCode === 400
  );
});

test("general employee updates cannot bypass deactivation permission", () => {
  assert.throws(
    () =>
      normaliseEmployeeManagementUpdate({
        isActive: false,
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

test("employee management rejects unsupported permissions", () => {
  assert.throws(
    () =>
      normaliseEmployeeManagementUpdate({
        permissions: [
          "employee:read",
          "system:owner",
        ],
      }),
    (error) =>
      error.statusCode === 400
  );
});

test("employee special permissions exclude Super Admin-only authority", () => {
  for (const reserved of [
    "employee:role:update",
    "employee:permissions:update",
  ]) {
    assert.throws(
      () =>
        normaliseEmployeeManagementUpdate({
          permissions: [
            "employee:read",
            reserved,
          ],
        }),
      (error) =>
        error.statusCode === 400
    );
  }
});

test("employee schedule normalises working hours and breaks", () => {
  assert.deepEqual(
    normaliseEmployeeSchedule([
      {
        day: "Monday",
        available: true,
        start: "09:00",
        end: "17:00",
        breaks: [
          {
            start: "13:00",
            end: "13:30",
          },
          {
            start: "11:00",
            end: "11:15",
          },
        ],
      },
    ]),
    [
      {
        day: "Monday",
        available: true,
        start: "09:00",
        end: "17:00",
        breaks: [
          {
            start: "11:00",
            end: "11:15",
          },
          {
            start: "13:00",
            end: "13:30",
          },
        ],
      },
    ]
  );
});

test("employee schedule rejects overlapping breaks", () => {
  assert.throws(
    () =>
      normaliseEmployeeSchedule([
        {
          day: "Tuesday",
          start: "09:00",
          end: "17:00",
          breaks: [
            {
              start: "12:00",
              end: "13:00",
            },
            {
              start: "12:30",
              end: "13:30",
            },
          ],
        },
      ]),
    (error) =>
      error.statusCode === 400
  );
});

test("employee schedule rejects breaks outside working hours", () => {
  assert.throws(
    () =>
      normaliseEmployeeSchedule([
        {
          day: "Wednesday",
          start: "09:00",
          end: "17:00",
          breaks: [
            {
              start: "08:30",
              end: "09:15",
            },
          ],
        },
      ]),
    (error) =>
      error.statusCode === 400
  );
});


test("employee workforce reconciliation respects explicit account links and uses email only for unlinked legacy profiles", () => {
  const staffUsers = [
    {
      _id: "user-a",
      name: "Account A",
      email: "a@example.com",
      role: "admin",
      isActive: true,
    },
    {
      _id: "user-b",
      name: "Account B",
      email: "b@example.com",
      role: "stylist",
      isActive: true,
    },
    {
      _id: "user-c",
      name: "Account C",
      email: "c@example.com",
      role: "stylist",
      isActive: true,
    },
  ];

  const stylistProfiles = [
    {
      _id: "profile-b",
      userAccount: "user-b",
      email: "a@example.com",
      firstName: "Linked",
      lastName: "B",
      profileImage:
        "/staff/profile-b.jpg",
      isActive: true,
      profilePublished: true,
      acceptsAppointments: true,
    },
    {
      _id: "profile-c",
      email: "c@example.com",
      firstName: "Legacy",
      lastName: "C",
      isActive: true,
      profilePublished: true,
      acceptsAppointments: true,
    },
    {
      _id: "profile-history",
      email: "history@example.com",
      firstName: "Historic",
      lastName: "Stylist",
      isActive: false,
      profilePublished: false,
      acceptsAppointments: false,
    },
  ];

  const result =
    buildAdminWorkforceRoster(
      staffUsers,
      stylistProfiles
    );

  const accountA =
    result.signInEnabledRows.find(
      (row) =>
        row.id === "user-a"
    );
  const accountB =
    result.signInEnabledRows.find(
      (row) =>
        row.id === "user-b"
    );
  const accountC =
    result.signInEnabledRows.find(
      (row) =>
        row.id === "user-c"
    );

  assert.equal(
    accountA.stylistProfile,
    null
  );
  assert.equal(
    accountB.stylistProfile.id,
    "profile-b"
  );
  assert.equal(
    accountB.profilePhoto,
    "/staff/profile-b.jpg"
  );
  assert.equal(
    accountC.stylistProfile.id,
    "profile-c"
  );

  assert.equal(
    result.signInDisabledRows.length,
    1
  );
  assert.equal(
    result.signInDisabledRows[0].id,
    "profile:profile-history"
  );
  assert.equal(
    result.signInDisabledRows[0].signInEnabled,
    false
  );
  assert.equal(
    result.signInDisabledRows[0].isActive,
    false
  );
  assert.deepEqual(
    result.signInDisabledRows[0].permissions,
    []
  );
});

test("employee roster includes login accounts and unlinked salon staff profiles", async () => {
  const controller =
    await readFile(
      new URL(
        "../controllers/adminUserController.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    controller,
    /User\.find\(\{[\s\S]*?role:[\s\S]*?\$ne:[\s\S]*?"customer"/
  );

  assert.match(
    controller,
    /Stylist\.find\(\)/
  );

  assert.match(
    controller,
    /serialiseEmployeeWithoutSignIn/
  );

  assert.match(
    controller,
    /signInEnabled:\s*false/
  );

  assert.match(
    controller,
    /signInDisabledTotal:/
  );

  assert.match(
    controller,
    /Sign-in not enabled/
  );

  assert.match(
    controller,
    /permissions:\s*\[\]/
  );

  const rosterStart =
    controller.indexOf(
      "export async function listAdminUsers"
    );
  const rosterEnd =
    controller.indexOf(
      "async function employeeAndProfile",
      rosterStart
    );
  const rosterSource =
    controller.slice(
      rosterStart,
      rosterEnd
    );

  assert.doesNotMatch(
    rosterSource,
    /User\.create\(/
  );
});

test("Employees and Staff Accounts keep all employees in one management model", async () => {
  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/AdminStaffAccountsPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    page,
    /Sign-in not enabled/
  );

  assert.match(
    page,
    /accessFilter/
  );

  assert.match(
    page,
    /All sign-in states/
  );

  assert.doesNotMatch(
    page,
    /sign_in_disabled/
  );

  assert.match(
    page,
    /Manage employee/
  );

  assert.match(
    page,
    /employeeManagementPath/
  );

  assert.match(
    page,
    /user\.signInEnabled ===[\s\S]*?false/
  );

  assert.match(
    page,
    /stylistService\.updateStylist/
  );
});

test("management staff profile editor keeps employees unified while showing sign-in state", async () => {
  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/StaffProfileEditorPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    page,
    /employee[\s\S]*?stylistProfile[\s\S]*?id/
  );

  assert.match(
    page,
    /sign-in not enabled/
  );

  assert.match(
    page,
    /every employee with a staff profile/
  );
});

test("employee dashboard preserves multiple daily breaks", async () => {
  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/AdminEmployeeDetailPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    page,
    /function addBreak\(/
  );
  assert.match(
    page,
    /function updateBreak\(/
  );
  assert.match(
    page,
    /function removeBreak\(/
  );
  assert.match(
    page,
    /row\.breaks \|\| \[\]/
  );
  assert.doesNotMatch(
    page,
    /breakStart|breakEnd/
  );
});

test("employee service assignment uses management catalogue and preserves unpublished services", async () => {
  const page =
    await readFile(
      new URL(
        "../../../frontend/src/pages/AdminEmployeeDetailPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    page,
    /serviceService\.getManagementServices\(\)/
  );
  assert.doesNotMatch(
    page,
    /serviceService\.getServices\(\)/
  );
  assert.match(
    page,
    /"service:read"/
  );
  assert.match(
    page,
    /canManageServices/
  );
  assert.match(
    page,
    /service\.active === false \? "Unpublished" : "Published"/
  );
  assert.doesNotMatch(
    page,
    /services\.filter\([\s\S]*service\.active !==[\s\S]*false/
  );
});


test("Administrator baseline can manage employee-specific permissions but not access roles", () => {
  const permissions =
    permissionsForRole(
      "admin"
    );

  assert.equal(
    permissions.includes(
      "employee:permissions:update"
    ),
    true
  );
  assert.equal(
    permissions.includes(
      "employee:role:update"
    ),
    false
  );
});

test("employee settings route uses field-sensitive permission guards", async () => {
  const routes =
    await readFile(
      new URL(
        "../routes/authRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /requireEmployeeSettingsChanges/
  );
  assert.match(
    routes,
    /"employee:permissions:update"/
  );
  assert.match(
    routes,
    /"employee:role:update"/
  );
  assert.match(
    routes,
    /"employee:update"/
  );

  const patchStart =
    routes.indexOf(
      'router.patch(\n  "/admin/staff/:id"'
    );
  const patchEnd =
    routes.indexOf(
      ");",
      patchStart
    );
  const patchSource =
    routes.slice(
      patchStart,
      patchEnd
    );

  assert.match(
    patchSource,
    /requireEmployeeSettingsChanges/
  );
  assert.doesNotMatch(
    patchSource,
    /requirePermissions\(/
  );
});

test("Administrator cannot mutate a Super Admin account through employee settings", async () => {
  const controller =
    await readFile(
      new URL(
        "../controllers/adminUserController.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    controller,
    /Only a Super Admin can modify a Super Admin account\./
  );
});


test("existing employee sign-in credentials are normalised without changing employee data", () => {
  assert.deepEqual(
    normaliseEmployeeSignInRequest({
      email:
        "  EMPLOYEE@Example.COM  ",
      password:
        "temporary-pass",
      role:
        "stylist",
      profilePublished:
        false,
      services: [],
    }),
    {
      email:
        "employee@example.com",
      password:
        "temporary-pass",
      role:
        "stylist",
    }
  );
});

test("existing employee sign-in requires a valid email and an eight-character password", () => {
  assert.throws(
    () =>
      normaliseEmployeeSignInRequest({
        email:
          "not-an-email",
        password:
          "temporary-pass",
        role:
          "stylist",
      }),
    (error) =>
      error.statusCode ===
      400
  );

  assert.throws(
    () =>
      normaliseEmployeeSignInRequest({
        email:
          "employee@example.com",
        password:
          "short",
        role:
          "stylist",
      }),
    (error) =>
      error.statusCode ===
      400
  );
});

test("existing employee sign-in endpoint links the current record instead of creating another profile", async () => {
  const controller =
    await readFile(
      new URL(
        "../controllers/adminUserController.js",
        import.meta.url
      ),
      "utf8"
    );
  const routes =
    await readFile(
      new URL(
        "../routes/authRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  const start =
    controller.indexOf(
      "export async function enableEmployeeSignIn"
    );
  const end =
    controller.indexOf(
      "export async function updateEmployeeServices",
      start
    );
  const handler =
    controller.slice(
      start,
      end
    );

  assert.match(
    routes,
    /\/admin\/staff-record\/:id\/sign-in/
  );
  assert.match(
    routes,
    /"employee:create"/
  );
  assert.match(
    handler,
    /Stylist\.findById\(/
  );
  assert.match(
    handler,
    /stylist\.userAccount\s*=\s*createdUser\._id/
  );
  assert.match(
    handler,
    /stylist\.email\s*=\s*email/
  );
  assert.match(
    handler,
    /action:\s*"employee\.sign_in_enabled"/
  );
  assert.match(
    handler,
    /Stylist\.replaceOne\(/
  );
  assert.match(
    handler,
    /User\.deleteOne\(/
  );
  assert.doesNotMatch(
    handler,
    /Stylist\.create\(/
  );
});
