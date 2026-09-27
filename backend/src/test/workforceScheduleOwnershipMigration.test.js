import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  buildWorkforceOwnershipReadiness,
} from "../platform/tenancy/workforceOwnershipMigration.js";
import {
  buildWorkforceScheduleBackfillPlan,
} from "../platform/tenancy/workforceScheduleOwnershipMigration.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

function safeReadiness({
  businessId,
  locationId,
  stylistId,
}) {
  return buildWorkforceOwnershipReadiness({
    businessId,
    locationId,
    stylists: [
      {
        _id:
          stylistId,
        email:
          "employee@example.com",
        workingLocations:
          [],
      },
    ],
    users: [],
    memberships: [],
  });
}

test("single-location schedule plan assigns Business and trusted Location without writes", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const stylistId =
    oid();
  const availabilityId =
    oid();
  const timeOffId =
    oid();
  const shiftId =
    oid();
  const attendanceId =
    oid();

  const plan =
    buildWorkforceScheduleBackfillPlan({
      workforceReadiness:
        safeReadiness({
          businessId,
          locationId,
          stylistId,
        }),
      availabilities: [
        {
          _id:
            availabilityId,
          staff:
            stylistId,
        },
      ],
      timeOff: [
        {
          _id:
            timeOffId,
          staff:
            stylistId,
        },
      ],
      shifts: [
        {
          _id:
            shiftId,
          staff:
            stylistId,
          location:
            "Main salon",
        },
      ],
      attendance: [
        {
          _id:
            attendanceId,
          shift:
            shiftId,
          staff:
            stylistId,
        },
      ],
    });

  assert.equal(
    plan.executable,
    true
  );
  assert.equal(
    plan.writesPerformed,
    false
  );
  assert.equal(
    plan.operationTypes[
      "availability-update"
    ],
    1
  );
  assert.equal(
    plan.operationTypes[
      "time-off-update"
    ],
    1
  );
  assert.equal(
    plan.operationTypes[
      "shift-update"
    ],
    1
  );
  assert.equal(
    plan.operationTypes[
      "attendance-update"
    ],
    1
  );

  const timeOffUpdate =
    plan.operations.find(
      (item) =>
        item.type ===
        "time-off-update"
    );

  assert.equal(
    timeOffUpdate.set.business,
    String(
      businessId
    )
  );
  assert.equal(
    "location" in
      timeOffUpdate.set,
    false
  );

  const shiftUpdate =
    plan.operations.find(
      (item) =>
        item.type ===
        "shift-update"
    );

  assert.equal(
    shiftUpdate.set.locationRef,
    String(
      locationId
    )
  );
});

test("schedule plan blocks records owned by another Business or Location", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const stylistId =
    oid();

  const plan =
    buildWorkforceScheduleBackfillPlan({
      workforceReadiness:
        safeReadiness({
          businessId,
          locationId,
          stylistId,
        }),
      shifts: [
        {
          _id:
            oid(),
          staff:
            stylistId,
          business:
            oid(),
          locationRef:
            oid(),
        },
      ],
    });

  assert.equal(
    plan.executable,
    false
  );
  assert.equal(
    plan.operations.length,
    0
  );
  assert.ok(
    plan.blockers.some(
      (item) =>
        item.blocker ===
        "record-owned-by-other-business"
    )
  );
  assert.ok(
    plan.blockers.some(
      (item) =>
        item.blocker ===
        "record-owned-by-other-location"
    )
  );
});

test("schedule plan blocks attendance whose staff does not match its shift", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const stylistId =
    oid();
  const otherStylistId =
    oid();
  const shiftId =
    oid();

  const readiness =
    buildWorkforceOwnershipReadiness({
      businessId,
      locationId,
      stylists: [
        {
          _id:
            stylistId,
          email:
            "one@example.com",
        },
        {
          _id:
            otherStylistId,
          email:
            "two@example.com",
        },
      ],
      users: [],
      memberships: [],
    });

  const plan =
    buildWorkforceScheduleBackfillPlan({
      workforceReadiness:
        readiness,
      shifts: [
        {
          _id:
            shiftId,
          staff:
            stylistId,
        },
      ],
      attendance: [
        {
          _id:
            oid(),
          shift:
            shiftId,
          staff:
            otherStylistId,
        },
      ],
    });

  assert.equal(
    plan.executable,
    false
  );
  assert.ok(
    plan.blockers.some(
      (item) =>
        item.blocker ===
        "attendance-staff-shift-mismatch"
    )
  );
});

test("schedule plan blocks child records whose staff is outside the workforce readiness set", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const stylistId =
    oid();

  const plan =
    buildWorkforceScheduleBackfillPlan({
      workforceReadiness:
        safeReadiness({
          businessId,
          locationId,
          stylistId,
        }),
      availabilities: [
        {
          _id:
            oid(),
          staff:
            oid(),
        },
      ],
    });

  assert.equal(
    plan.executable,
    false
  );
  assert.ok(
    plan.blockers.some(
      (item) =>
        item.blocker ===
        "unknown-workforce-staff"
    )
  );
});
