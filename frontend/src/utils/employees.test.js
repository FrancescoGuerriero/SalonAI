import assert from "node:assert/strict";
import test from "node:test";

import {
  employeeDisplayPhoto,
  employeeManagementPath,
  employeeScheduleForDate,
  employeeServiceNames,
} from "./employees.js";

test("employee schedule reports today's configured hours", () => {
  const employee = {
    stylistProfile: {
      workingHours: [
        {
          day: "Wednesday",
          start: "09:30",
          end: "18:00",
          available: true,
        },
      ],
    },
  };

  assert.equal(
    employeeScheduleForDate(
      employee,
      new Date(
        "2026-09-16T12:00:00Z"
      )
    ),
    "09:30–18:00"
  );
});

test("employee schedule reports days off", () => {
  assert.equal(
    employeeScheduleForDate(
      {
        stylistProfile: {
          workingHours: [
            {
              day: "Wednesday",
              available: false,
            },
          ],
        },
      },
      new Date(
        "2026-09-16T12:00:00Z"
      )
    ),
    "Off"
  );
});

test("employee service names support populated services", () => {
  assert.deepEqual(
    employeeServiceNames({
      stylistProfile: {
        services: [
          { name: "Balayage" },
          { name: "Blow Dry" },
        ],
      },
    }),
    ["Balayage", "Blow Dry"]
  );
});



test("employee photo prefers the account image and falls back to the staff profile image", () => {
  assert.equal(
    employeeDisplayPhoto({
      profilePhoto:
        "/accounts/francesco.jpg",
      stylistProfile: {
        profileImage:
          "/profiles/francesco.jpg",
      },
    }),
    "/accounts/francesco.jpg"
  );

  assert.equal(
    employeeDisplayPhoto({
      profilePhoto: "",
      stylistProfile: {
        profileImage:
          "/profiles/francesco.jpg",
      },
    }),
    "/profiles/francesco.jpg"
  );
});

test("employee management path stays unified regardless of sign-in state", () => {
  assert.equal(
    employeeManagementPath({
      id: "user-1",
      signInEnabled: true,
    }),
    "/admin/employees/user-1"
  );

  assert.equal(
    employeeManagementPath({
      id: "profile:profile-1",
      profileId:
        "profile-1",
      signInEnabled: false,
      stylistProfile: {
        id:
          "profile-1",
      },
    }),
    "/admin/employees/record/profile-1"
  );
});
