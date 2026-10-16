import assert from "node:assert/strict";
import test from "node:test";

import {
  staffAvailabilityMutationScope,
} from "../services/staffAvailabilityMutationService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439012";
const STAFF_ID =
  "507f1f77bcf86cd799439021";
const LOCATION_A =
  "507f1f77bcf86cd799439013";

function authority({
  locationId = LOCATION_A,
  mode = "selected",
  allowed = [LOCATION_A],
} = {}) {
  return {
    businessId: BUSINESS_ID,
    locationId,
    locationAccessMode: mode,
    allowedLocationIds:
      mode === "all" ? null : allowed,
  };
}

test("availability mutation scope stamps trusted Business and selected Location", () => {
  assert.deepEqual(
    staffAvailabilityMutationScope(
      authority(),
      STAFF_ID
    ),
    {
      businessId:
        BUSINESS_ID,
      locationId:
        LOCATION_A,
      staffMatch: {
        _id: STAFF_ID,
        business:
          BUSINESS_ID,
        workingLocations:
          LOCATION_A,
      },
    }
  );
});

test("availability mutation scope rejects missing trusted selected Location", () => {
  assert.throws(
    () =>
      staffAvailabilityMutationScope(
        authority({
          locationId: null,
          mode: "all",
          allowed: [],
        }),
        STAFF_ID
      ),
    (error) =>
      error?.code ===
        "STAFF_SCHEDULE_LOCATION_CONTEXT_REQUIRED" &&
      error?.statusCode === 403
  );
});

test("availability mutation scope rejects invalid staff id", () => {
  assert.throws(
    () =>
      staffAvailabilityMutationScope(
        authority(),
        "not-an-object-id"
      ),
    (error) =>
      error?.code ===
        "INVALID_STAFF_ID" &&
      error?.statusCode === 400
  );
});

test("availability mutation scope never accepts client ownership fields", () => {
  const scope =
    staffAvailabilityMutationScope(
      authority(),
      STAFF_ID
    );

  assert.equal(
    scope.businessId,
    BUSINESS_ID
  );
  assert.equal(
    scope.locationId,
    LOCATION_A
  );
  assert.equal(
    "clientBusiness" in scope,
    false
  );
  assert.equal(
    "clientLocation" in scope,
    false
  );
});
