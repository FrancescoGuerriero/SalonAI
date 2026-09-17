import assert from "node:assert/strict";
import test from "node:test";

import {
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

