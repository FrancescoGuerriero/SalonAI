import assert from "node:assert/strict";
import test from "node:test";

import {
  staffAvailabilityStaffScope,
} from "../services/staffAvailabilityAuthorityService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439012";
const STAFF_ID =
  "507f1f77bcf86cd799439021";
const LOCATION_A =
  "507f1f77bcf86cd799439013";
const LOCATION_B =
  "507f1f77bcf86cd799439014";

function authority({
  mode = "all",
  allowed = [],
} = {}) {
  return {
    businessId: BUSINESS_ID,
    locationAccessMode: mode,
    allowedLocationIds:
      mode === "all" ? null : allowed,
  };
}

test("all-location availability staff scope stays inside trusted Business", () => {
  assert.deepEqual(
    staffAvailabilityStaffScope(
      authority(),
      STAFF_ID
    ),
    {
      _id: STAFF_ID,
      business: BUSINESS_ID,
    }
  );
});

test("selected-location availability staff scope requires working-location intersection", () => {
  assert.deepEqual(
    staffAvailabilityStaffScope(
      authority({
        mode: "selected",
        allowed: [LOCATION_A, LOCATION_B],
      }),
      STAFF_ID
    ),
    {
      _id: STAFF_ID,
      business: BUSINESS_ID,
      workingLocations: {
        $in: [LOCATION_A, LOCATION_B],
      },
    }
  );
});

test("selected-location availability staff scope fails closed when no locations are allowed", () => {
  assert.deepEqual(
    staffAvailabilityStaffScope(
      authority({
        mode: "selected",
        allowed: [],
      }),
      STAFF_ID
    ),
    {
      _id: {
        $exists: false,
      },
      business: BUSINESS_ID,
    }
  );
});

test("availability staff scope rejects missing trusted Business authority", () => {
  assert.throws(
    () =>
      staffAvailabilityStaffScope(
        {},
        STAFF_ID
      ),
    (error) =>
      error?.code ===
        "STAFF_AVAILABILITY_AUTHORITY_REQUIRED" &&
      error?.statusCode === 401
  );
});
