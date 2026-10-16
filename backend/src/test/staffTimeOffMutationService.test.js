import assert from "node:assert/strict";
import test from "node:test";

import {
  staffTimeOffCreationScope,
} from "../services/staffTimeOffMutationService.js";

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

test("selected-location time-off creation stamps trusted Business and Location", () => {
  assert.deepEqual(
    staffTimeOffCreationScope(
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

test("all-location authority may create explicit Business-wide time-off", () => {
  assert.deepEqual(
    staffTimeOffCreationScope(
      authority({
        locationId: null,
        mode: "all",
        allowed: [],
      }),
      STAFF_ID
    ),
    {
      businessId:
        BUSINESS_ID,
      locationId: null,
      staffMatch: {
        _id: STAFF_ID,
        business:
          BUSINESS_ID,
      },
    }
  );
});

test("selected-location authority fails closed without a trusted selected Location", () => {
  assert.throws(
    () =>
      staffTimeOffCreationScope(
        authority({
          locationId: null,
          mode: "selected",
          allowed: [LOCATION_A],
        }),
        STAFF_ID
      ),
    (error) =>
      error?.code ===
        "STAFF_SCHEDULE_LOCATION_CONTEXT_REQUIRED" &&
      error?.statusCode === 403
  );
});

test("time-off creation rejects invalid staff id", () => {
  assert.throws(
    () =>
      staffTimeOffCreationScope(
        authority(),
        "invalid"
      ),
    (error) =>
      error?.code ===
        "INVALID_STAFF_ID" &&
      error?.statusCode === 400
  );
});
