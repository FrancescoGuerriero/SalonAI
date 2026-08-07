import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAvailableSlots,
  parseBookingDate,
  stylistOffersService,
} from "../services/bookingAvailabilityService.js";

const FUTURE_DATE = "2030-06-15";
const BEFORE_FUTURE_DATE = new Date(2030, 5, 14, 12, 0, 0);

test("parseBookingDate accepts real calendar dates", () => {
  const date = parseBookingDate(FUTURE_DATE);

  assert.equal(date.getFullYear(), 2030);
  assert.equal(date.getMonth(), 5);
  assert.equal(date.getDate(), 15);
});

test("parseBookingDate rejects impossible calendar dates", () => {
  assert.throws(
    () => parseBookingDate("2030-02-30"),
    /valid calendar date/
  );
});

test("buildAvailableSlots fits the complete service inside working hours", () => {
  const slots = buildAvailableSlots({
    date: FUTURE_DATE,
    ranges: [{ start: "09:00", end: "11:00" }],
    duration: 60,
    now: BEFORE_FUTURE_DATE,
  });

  assert.deepEqual(slots, ["09:00", "09:30", "10:00"]);
});

test("buildAvailableSlots removes times that overlap appointments", () => {
  const slots = buildAvailableSlots({
    date: FUTURE_DATE,
    ranges: [{ start: "09:00", end: "12:00" }],
    duration: 60,
    now: BEFORE_FUTURE_DATE,
    appointments: [
      {
        startsAt: new Date(2030, 5, 15, 9, 30),
        endsAt: new Date(2030, 5, 15, 10, 30),
        status: "confirmed",
      },
    ],
  });

  assert.deepEqual(slots, ["10:30", "11:00"]);
});

test("buildAvailableSlots removes approved time-off intervals", () => {
  const slots = buildAvailableSlots({
    date: FUTURE_DATE,
    ranges: [{ start: "09:00", end: "12:00" }],
    duration: 30,
    now: BEFORE_FUTURE_DATE,
    timeOff: [
      {
        startsAt: new Date(2030, 5, 15, 10, 0),
        endsAt: new Date(2030, 5, 15, 11, 0),
      },
    ],
  });

  assert.deepEqual(slots, [
    "09:00",
    "09:30",
    "11:00",
    "11:30",
  ]);
});

test("buildAvailableSlots ignores cancelled appointments", () => {
  const slots = buildAvailableSlots({
    date: FUTURE_DATE,
    ranges: [{ start: "09:00", end: "10:00" }],
    duration: 30,
    now: BEFORE_FUTURE_DATE,
    appointments: [
      {
        appointmentDate: new Date(2030, 5, 15),
        appointmentTime: "09:00",
        duration: 30,
        status: "cancelled",
      },
    ],
  });

  assert.deepEqual(slots, ["09:00", "09:30"]);
});

test("buildAvailableSlots does not offer elapsed times", () => {
  const slots = buildAvailableSlots({
    date: FUTURE_DATE,
    ranges: [{ start: "09:00", end: "11:00" }],
    duration: 30,
    now: new Date(2030, 5, 15, 9, 35),
  });

  assert.deepEqual(slots, ["10:00", "10:30"]);
});

test("stylistOffersService enforces explicit service assignments", () => {
  assert.equal(
    stylistOffersService(
      { services: [{ _id: "service-a" }, "service-b"] },
      "service-b"
    ),
    true
  );

  assert.equal(
    stylistOffersService(
      { services: [{ _id: "service-a" }] },
      "service-b"
    ),
    false
  );

  assert.equal(
    stylistOffersService({ services: [] }, "service-b"),
    true
  );
});
