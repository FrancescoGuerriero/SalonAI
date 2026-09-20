import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildAdminWorkforceRoster,
  normaliseEmployeeManagementUpdate,
  normaliseEmployeeSchedule,
} from "../controllers/adminUserController.js";

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
    result.accountRows.find(
      (row) =>
        row.id === "user-a"
    );
  const accountB =
    result.accountRows.find(
      (row) =>
        row.id === "user-b"
    );
  const accountC =
    result.accountRows.find(
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
    accountC.stylistProfile.id,
    "profile-c"
  );

  assert.equal(
    result.profileRows.length,
    1
  );
  assert.equal(
    result.profileRows[0].id,
    "profile:profile-history"
  );
  assert.equal(
    result.profileRows[0].accountLinked,
    false
  );
  assert.equal(
    result.profileRows[0].isActive,
    false
  );
  assert.deepEqual(
    result.profileRows[0].permissions,
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
    /serialiseProfileOnlyEmployee/
  );

  assert.match(
    controller,
    /employeeType:\s*"profile-only"/
  );

  assert.match(
    controller,
    /accountLinked:\s*false/
  );

  assert.match(
    controller,
    /profileOnlyTotal:/
  );

  assert.match(
    controller,
    /No login account/
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

test("Employees and Staff Accounts expose profile-only workforce records safely", async () => {
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
    /Profile only · no login account/
  );

  assert.match(
    page,
    /profile_only/
  );

  assert.match(
    page,
    /Manage staff profile/
  );

  assert.match(
    page,
    /user\.accountLinked ===[\s\S]*?false/
  );

  assert.match(
    page,
    /stylistService\.updateStylist/
  );
});

test("management staff profile editor includes unlinked staff profiles", async () => {
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
    /no login account/
  );

  assert.match(
    page,
    /every current staff profile visible to management/
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
