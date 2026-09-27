import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import StaffAvailability from "../features/staff/StaffAvailability.js";
import StaffTimeOff from "../features/staff/StaffTimeOff.js";
import StaffShift from "../features/staffRota/StaffShift.js";
import StaffAttendance from "../features/staffRota/StaffAttendance.js";
import {
  buildWorkforceOwnershipReadiness,
} from "../platform/tenancy/workforceOwnershipMigration.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

test("workforce schemas expose additive Business and Location ownership without making it required", () => {
  const businessId = oid();
  const locationId = oid();

  const stylist =
    new Stylist({
      business:
        businessId,
      workingLocations: [
        locationId,
        locationId,
      ],
      firstName:
        "Example",
      lastName:
        "Stylist",
      email:
        "stylist@example.com",
    });

  assert.equal(
    stylist.validateSync(),
    undefined
  );

  assert.equal(
    Stylist.schema.path(
      "business"
    ).options.required,
    undefined
  );

  assert.equal(
    StaffAvailability.schema.path(
      "business"
    ).options.required,
    undefined
  );

  assert.equal(
    StaffTimeOff.schema.path(
      "business"
    ).options.required,
    undefined
  );

  assert.equal(
    StaffShift.schema.path(
      "business"
    ).options.required,
    undefined
  );

  assert.equal(
    StaffAttendance.schema.path(
      "business"
    ).options.required,
    undefined
  );
});

test("Stylist retains legacy global unique identity indexes during the additive phase", () => {
  const indexes =
    Stylist.schema.indexes();

  const userAccountIndex =
    indexes.find(
      ([fields]) =>
        fields.userAccount === 1
    );

  assert.ok(
    userAccountIndex
  );
  assert.equal(
    userAccountIndex[1].unique,
    true
  );

  assert.equal(
    Stylist.schema.path(
      "email"
    ).options.unique,
    true
  );
});

test("workforce readiness preserves no-sign-in employees and proposes proven memberships only", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const linkedUserId =
    oid();

  const readiness =
    buildWorkforceOwnershipReadiness({
      businessId,
      locationId,
      stylists: [
        {
          _id:
            oid(),
          email:
            "linked@example.com",
          userAccount:
            linkedUserId,
          workingLocations:
            [],
        },
        {
          _id:
            oid(),
          email:
            "nosignin@example.com",
          workingLocations:
            [],
        },
      ],
      users: [
        {
          _id:
            linkedUserId,
          email:
            "linked@example.com",
          role:
            "stylist",
        },
      ],
      memberships: [],
    });

  assert.equal(
    readiness.safeForBackfill,
    true
  );
  assert.equal(
    readiness.summary.stylists,
    2
  );
  assert.equal(
    readiness.summary.linkedSignIn,
    1
  );
  assert.equal(
    readiness.summary.noSignIn,
    1
  );
  assert.equal(
    readiness.membershipCreates.length,
    1
  );
  assert.equal(
    readiness.membershipCreates[0]
      .userId,
    String(
      linkedUserId
    )
  );
});

test("email-only sign-in match is reported for manual review and never auto-linked", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const candidateUserId =
    oid();
  const stylistId =
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
            "candidate@example.com",
        },
      ],
      users: [
        {
          _id:
            candidateUserId,
          email:
            "candidate@example.com",
          role:
            "stylist",
        },
      ],
      memberships: [],
    });

  assert.equal(
    readiness.safeForBackfill,
    true
  );
  assert.equal(
    readiness.membershipCreates.length,
    0
  );
  assert.equal(
    readiness.manualLinkCandidates.length,
    1
  );
  assert.equal(
    readiness.plans[0]
      .signInState,
    "email-candidate-manual-review"
  );
});

test("workforce readiness fails closed on cross-business ownership", () => {
  const businessId =
    oid();
  const otherBusinessId =
    oid();
  const locationId =
    oid();

  const readiness =
    buildWorkforceOwnershipReadiness({
      businessId,
      locationId,
      stylists: [
        {
          _id:
            oid(),
          business:
            otherBusinessId,
          email:
            "other@example.com",
        },
      ],
      users: [],
      memberships: [],
    });

  assert.equal(
    readiness.safeForBackfill,
    false
  );
  assert.ok(
    readiness.blockers.some(
      (item) =>
        item.blocker ===
        "stylist-owned-by-other-business"
    )
  );
});

test("inactive existing membership is never silently reactivated", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const userId =
    oid();
  const stylistId =
    oid();

  const readiness =
    buildWorkforceOwnershipReadiness({
      businessId,
      locationId,
      stylists: [
        {
          _id:
            stylistId,
          userAccount:
            userId,
          email:
            "employee@example.com",
        },
      ],
      users: [
        {
          _id:
            userId,
          email:
            "employee@example.com",
          role:
            "manager",
        },
      ],
      memberships: [
        {
          _id:
            oid(),
          user:
            userId,
          business:
            businessId,
          roleKey:
            "manager",
          status:
            "suspended",
        },
      ],
    });

  assert.equal(
    readiness.safeForBackfill,
    false
  );
  assert.equal(
    readiness.plans[0]
      .membershipAction,
    "manual-review"
  );
  assert.equal(
    readiness.membershipCreates.length,
    0
  );
});

test("same User may already have another Business membership without blocking the target Business plan", () => {
  const businessId =
    oid();
  const otherBusinessId =
    oid();
  const locationId =
    oid();
  const userId =
    oid();

  const readiness =
    buildWorkforceOwnershipReadiness({
      businessId,
      locationId,
      stylists: [
        {
          _id:
            oid(),
          userAccount:
            userId,
          email:
            "multi@example.com",
        },
      ],
      users: [
        {
          _id:
            userId,
          email:
            "multi@example.com",
          role:
            "stylist",
        },
      ],
      memberships: [
        {
          _id:
            oid(),
          user:
            userId,
          business:
            otherBusinessId,
          roleKey:
            "stylist",
          status:
            "active",
        },
      ],
    });

  assert.equal(
    readiness.safeForBackfill,
    true
  );
  assert.equal(
    readiness.membershipCreates.length,
    1
  );
  assert.equal(
    readiness.membershipCreates[0]
      .business,
    String(
      businessId
    )
  );
});
