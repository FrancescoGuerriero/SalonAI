import assert from "node:assert/strict";
import test from "node:test";

import {
  staffTimeOffRecordScope,
  staffTimeOffStaffScope,
} from "../services/staffTimeOffAuthorityService.js";

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

test("all-location time-off workforce scope stays inside trusted Business", () => {
  assert.deepEqual(
    staffTimeOffStaffScope(
      authority()
    ),
    {
      business: BUSINESS_ID,
    }
  );
});

test("selected-location time-off workforce scope requires working-location intersection", () => {
  assert.deepEqual(
    staffTimeOffStaffScope(
      authority({
        mode: "selected",
        allowed: [LOCATION_A, LOCATION_B],
      }),
      STAFF_ID
    ),
    {
      business: BUSINESS_ID,
      _id: STAFF_ID,
      workingLocations: {
        $in: [LOCATION_A, LOCATION_B],
      },
    }
  );
});

test("selected-location time-off record scope includes Business-wide blocks only for already scoped employees", () => {
  assert.deepEqual(
    staffTimeOffRecordScope(
      authority({
        mode: "selected",
        allowed: [LOCATION_A],
      }),
      [STAFF_ID]
    ),
    {
      business: BUSINESS_ID,
      $or: [
        {
          location: {
            $in: [LOCATION_A],
          },
        },
        {
          $and: [
            {
              staff: {
                $in: [STAFF_ID],
              },
            },
            {
              $or: [
                { location: null },
                {
                  location: {
                    $exists: false,
                  },
                },
              ],
            },
          ],
        },
      ],
    }
  );
});

test("selected-location time-off workforce scope fails closed without allowed locations", () => {
  assert.deepEqual(
    staffTimeOffStaffScope(
      authority({
        mode: "selected",
        allowed: [],
      })
    ),
    {
      business: BUSINESS_ID,
      _id: {
        $exists: false,
      },
    }
  );
});
