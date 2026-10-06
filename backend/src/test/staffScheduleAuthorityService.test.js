import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAppointmentBackedScheduleScope,
  assertStaffScheduleRecordAuthority,
  staffScheduleBusinessScope,
  staffScheduleCreationOwnership,
  staffScheduleLocationScope,
} from "../services/staffScheduleAuthorityService.js";

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
  "business-wide schedule scope uses only the trusted Business",
  () => {
    assert.deepEqual(
      staffScheduleBusinessScope(
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
  "selected-location schedule scope is bounded to trusted allowed locations",
  () => {
    assert.deepEqual(
      staffScheduleLocationScope(
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
        location: {
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
  "time-off scope may include explicit Business-wide records",
  () => {
    assert.deepEqual(
      staffScheduleLocationScope(
        authority({
          mode:
            "selected",
          allowed: [
            LOCATION_A,
          ],
        }),
        {
          includeBusinessWide:
            true,
        }
      ),
      {
        business:
          BUSINESS_ID,
        $or: [
          {
            location: {
              $in: [
                LOCATION_A,
              ],
            },
          },
          {
            location:
              null,
          },
          {
            location: {
              $exists:
                false,
            },
          },
        ],
      }
    );
  }
);

test(
  "location-owned schedule creation requires trusted selected location",
  () => {
    assert.deepEqual(
      staffScheduleCreationOwnership(
        authority({
          mode:
            "selected",
          locationId:
            LOCATION_A,
          allowed: [
            LOCATION_A,
            LOCATION_B,
          ],
        })
      ),
      {
        businessId:
          BUSINESS_ID,
        locationId:
          LOCATION_A,
      }
    );

    assert.throws(
      () =>
        staffScheduleCreationOwnership(
          authority({
            mode:
              "selected",
            allowed: [
              LOCATION_A,
            ],
          })
        ),
      (error) =>
        error?.code ===
          "STAFF_SCHEDULE_LOCATION_CONTEXT_REQUIRED" &&
        error?.statusCode ===
          403
    );
  }
);

test(
  "all-location authority may create an explicitly Business-wide schedule record only when allowed",
  () => {
    assert.deepEqual(
      staffScheduleCreationOwnership(
        authority(),
        {
          allowBusinessWide:
            true,
        }
      ),
      {
        businessId:
          BUSINESS_ID,
        locationId:
          null,
      }
    );
  }
);

test(
  "cross-Business schedule record access fails non-disclosing",
  () => {
    assert.throws(
      () =>
        assertStaffScheduleRecordAuthority(
          authority(),
          {
            business:
              OTHER_BUSINESS_ID,
            location:
              LOCATION_A,
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
  "selected-location authority cannot access a record at another location",
  () => {
    assert.throws(
      () =>
        assertStaffScheduleRecordAuthority(
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
            location:
              LOCATION_B,
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
  "strict schedule operation requires the active selected trusted location",
  () => {
    const selected =
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

    assert.deepEqual(
      assertStaffScheduleRecordAuthority(
        selected,
        {
          business:
            BUSINESS_ID,
          location:
            LOCATION_A,
        },
        {
          requireSelectedLocation:
            true,
        }
      ),
      {
        businessId:
          BUSINESS_ID,
        locationId:
          LOCATION_A,
      }
    );

    assert.throws(
      () =>
        assertStaffScheduleRecordAuthority(
          selected,
          {
            business:
              BUSINESS_ID,
            location:
              LOCATION_B,
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
  "Business-wide time-off record is readable only through the explicit Business-wide contract",
  () => {
    assert.deepEqual(
      assertStaffScheduleRecordAuthority(
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
          location:
            null,
        },
        {
          allowBusinessWide:
            true,
        }
      ),
      {
        businessId:
          BUSINESS_ID,
        locationId:
          null,
      }
    );
  }
);

test(
  "selected-location appointment-backed schedule views fail closed until Appointment ownership lands",
  () => {
    assert.throws(
      () =>
        assertAppointmentBackedScheduleScope(
          authority({
            mode:
              "selected",
            locationId:
              LOCATION_A,
            allowed: [
              LOCATION_A,
            ],
          })
        ),
      (error) =>
        error?.code ===
          "APPOINTMENT_LOCATION_SCOPE_REQUIRED" &&
        error?.statusCode ===
          409
    );
  }
);

test(
  "Business-wide appointment-backed schedule contract remains explicitly identifiable",
  () => {
    assert.deepEqual(
      assertAppointmentBackedScheduleScope(
        authority()
      ),
      {
        businessId:
          BUSINESS_ID,
        allowed:
          true,
      }
    );
  }
);

test(
  "client-like location values do not create authority",
  () => {
    assert.throws(
      () =>
        assertStaffScheduleRecordAuthority(
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
            location:
              LOCATION_C,
            requestedLocation:
              LOCATION_A,
          }
        ),
      (error) =>
        error?.code ===
          "RESOURCE_NOT_FOUND"
    );
  }
);
