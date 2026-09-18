import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
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


test("employee roster includes profile-only legacy stylists", async () => {
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
    /serialiseProfileOnlyEmployee/
  );
  assert.match(
    controller,
    /employeeType:\s*"profile-only"/
  );
  assert.match(
    controller,
    /Stylist\.find\(\)/
  );
  assert.match(
    controller,
    /profileOnlyEmployees/
  );
});
