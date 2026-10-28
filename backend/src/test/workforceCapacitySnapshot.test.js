import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkforceCapacitySnapshot,
  workingMinutesForDay,
} from "../features/aiPlatform/workforceCapacitySnapshotService.js";

const BUSINESS_ID = "507f1f77bcf86cd799439011";
const LOCATION_ID = "507f1f77bcf86cd799439012";

function stylist(overrides = {}) {
  return {
    _id: "507f1f77bcf86cd799439099",
    business: BUSINESS_ID,
    workingLocations: [LOCATION_ID],
    isActive: true,
    acceptsAppointments: true,
    workingHours: [
      {
        day: "Monday",
        start: "09:00",
        end: "17:00",
        available: true,
        breaks: [
          {
            start: "12:30",
            end: "13:00",
          },
        ],
      },
    ],
    ...overrides,
  };
}

test("working hours subtract governed breaks", () => {
  assert.equal(
    workingMinutesForDay(stylist().workingHours, "Monday"),
    450
  );
});

test("workforce snapshot aggregates only eligible staff in the exact Business and Location", () => {
  const snapshot = buildWorkforceCapacitySnapshot({
    businessId: BUSINESS_ID,
    locationId: LOCATION_ID,
    businessDate: "2026-11-02",
    stylists: [
      stylist(),
      stylist({
        _id: "507f1f77bcf86cd799439098",
        acceptsAppointments: false,
      }),
      stylist({
        _id: "507f1f77bcf86cd799439097",
        workingLocations: ["507f1f77bcf86cd799439013"],
      }),
      stylist({
        _id: "507f1f77bcf86cd799439096",
        business: "507f1f77bcf86cd799439014",
      }),
    ],
  });

  assert.equal(snapshot.availableStaffHours, 7.5);
  assert.equal(snapshot.eligibleStaffCount, 1);
  assert.equal(snapshot.appointmentCapacity, 0);
  assert.equal(snapshot.sourceRefs.length, 1);
  assert.equal(snapshot.metadata.aggregateOnly, true);
  assert.equal(
    snapshot.metadata.historicalBackfillAuthorised,
    false
  );
});

test("unavailable working day contributes zero capacity", () => {
  const snapshot = buildWorkforceCapacitySnapshot({
    businessId: BUSINESS_ID,
    locationId: LOCATION_ID,
    businessDate: "2026-11-03",
    stylists: [stylist()],
  });

  assert.equal(snapshot.availableStaffHours, 0);
  assert.equal(snapshot.eligibleStaffCount, 1);
});
