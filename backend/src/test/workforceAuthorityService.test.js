import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWorkforceResourceAuthority,
  scopedWorkforceFilter,
  workforceManagementScope,
} from "../services/workforceAuthorityService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439012";
const OTHER_BUSINESS_ID =
  "507f1f77bcf86cd799439099";
const LOCATION_A =
  "507f1f77bcf86cd799439013";
const LOCATION_B =
  "507f1f77bcf86cd799439014";
const LOCATION_C =
  "507f1f77bcf86cd799439015";

function authority({
  mode = "all",
  locationId = null,
  allowed = [],
} = {}) {
  return {
    businessId:
      BUSINESS_ID,
    locationId,
    locationAccessMode:
      mode,
    allowedLocationIds:
      mode === "all"
        ? null
        : allowed,
  };
}

test(
  "business-wide workforce scope filters only by trusted business ownership",
  () => {
    assert.deepEqual(
      workforceManagementScope(
        authority()
      ),
      {
        business:
          BUSINESS_ID,
      }
    );
  }
);

test(
  "selected-location workforce scope is bounded to allowed working locations",
  () => {
    assert.deepEqual(
      workforceManagementScope(
        authority({
          mode:
            "selected",
          allowed: [
            LOCATION_A,
            LOCATION_B,
          ],
        })
      ),
      {
        business:
          BUSINESS_ID,
        workingLocations: {
          $in: [
            LOCATION_A,
            LOCATION_B,
          ],
        },
      }
    );
  }
);

test(
  "domain search filters are composed without weakening workforce ownership scope",
  () => {
    const filter =
      scopedWorkforceFilter(
        authority({
          mode:
            "selected",
          allowed: [
            LOCATION_A,
          ],
        }),
        {
          $or: [
            {
              firstName: {
                $regex:
                  "Fran",
              },
            },
            {
              lastName: {
                $regex:
                  "Fran",
              },
            },
          ],
          isActive:
            true,
        }
      );

    assert.deepEqual(
      filter.$and[0],
      {
        business:
          BUSINESS_ID,
        workingLocations: {
          $in: [
            LOCATION_A,
          ],
        },
      }
    );

    assert.equal(
      filter.$and[1]
        .isActive,
      true
    );
  }
);

test(
  "business-wide management can see an owned employee regardless of publication or booking state",
  () => {
    const result =
      assertWorkforceResourceAuthority(
        authority(),
        {
          business:
            BUSINESS_ID,
          workingLocations:
            [],
          profilePublished:
            false,
          acceptsAppointments:
            false,
          isActive:
            false,
        }
      );

    assert.equal(
      result.businessId,
      BUSINESS_ID
    );
  }
);

test(
  "selected-location authority accepts employees working in any allowed location",
  () => {
    const result =
      assertWorkforceResourceAuthority(
        authority({
          mode:
            "selected",
          allowed: [
            LOCATION_A,
            LOCATION_B,
          ],
        }),
        {
          business:
            BUSINESS_ID,
          workingLocations: [
            LOCATION_B,
            LOCATION_C,
          ],
        }
      );

    assert.deepEqual(
      result.workingLocationIds,
      [
        LOCATION_B,
        LOCATION_C,
      ]
    );
  }
);

test(
  "cross-business and out-of-scope workforce records fail non-disclosing",
  () => {
    assert.throws(
      () =>
        assertWorkforceResourceAuthority(
          authority(),
          {
            business:
              OTHER_BUSINESS_ID,
            workingLocations: [
              LOCATION_A,
            ],
          }
        ),
      (error) =>
        error?.code ===
          "RESOURCE_NOT_FOUND" &&
        error?.statusCode ===
          404
    );

    assert.throws(
      () =>
        assertWorkforceResourceAuthority(
          authority({
            mode:
              "selected",
            allowed: [
              LOCATION_A,
            ],
          }),
          {
            business:
              BUSINESS_ID,
            workingLocations: [
              LOCATION_B,
            ],
          }
        ),
      (error) =>
        error?.code ===
          "RESOURCE_NOT_FOUND" &&
        error?.statusCode ===
          404
    );
  }
);

test(
  "strict selected-location operations require the active trusted location on the employee",
  () => {
    const scopedAuthority =
      authority({
        mode:
          "selected",
        locationId:
          LOCATION_A,
        allowed: [
          LOCATION_A,
          LOCATION_B,
        ],
      });

    assert.doesNotThrow(
      () =>
        assertWorkforceResourceAuthority(
          scopedAuthority,
          {
            business:
              BUSINESS_ID,
            workingLocations: [
              LOCATION_A,
              LOCATION_C,
            ],
          },
          {
            requireSelectedLocation:
              true,
          }
        )
    );

    assert.throws(
      () =>
        assertWorkforceResourceAuthority(
          scopedAuthority,
          {
            business:
              BUSINESS_ID,
            workingLocations: [
              LOCATION_B,
            ],
          },
          {
            requireSelectedLocation:
              true,
          }
        ),
      (error) =>
        error?.code ===
          "RESOURCE_NOT_FOUND" &&
        error?.statusCode ===
          404
    );
  }
);

test(
  "workforce scope does not use publication or booking flags as management authority",
  () => {
    const scope =
      workforceManagementScope(
        authority({
          mode:
            "selected",
          allowed: [
            LOCATION_A,
          ],
        })
      );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        scope,
        "profilePublished"
      ),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        scope,
        "acceptsAppointments"
      ),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        scope,
        "isActive"
      ),
      false
    );
  }
);
