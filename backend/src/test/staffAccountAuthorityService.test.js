import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStaffMembershipAuthority,
  newStaffMembershipPayload,
  staffAccountBusinessId,
  staffMembershipManagementFilter,
} from "../services/staffAccountAuthorityService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439012";
const OTHER_BUSINESS_ID =
  "507f1f77bcf86cd799439099";
const LOCATION_A =
  "507f1f77bcf86cd799439013";
const LOCATION_B =
  "507f1f77bcf86cd799439014";
const USER_ID =
  "507f1f77bcf86cd799439011";

function authority({
  mode = "all",
  allowed = [],
} = {}) {
  return {
    businessId:
      BUSINESS_ID,
    locationAccessMode:
      mode,
    allowedLocationIds:
      mode === "all"
        ? null
        : allowed,
  };
}

test(
  "business-wide staff account authority is bound to the trusted Business",
  () => {
    assert.equal(
      staffAccountBusinessId(
        authority()
      ),
      BUSINESS_ID
    );

    assert.deepEqual(
      staffMembershipManagementFilter(
        authority()
      ),
      {
        business:
          BUSINESS_ID,
        status: {
          $ne:
            "revoked",
        },
      }
    );
  }
);

test(
  "selected-location managers can see only memberships intersecting allowed locations",
  () => {
    assert.deepEqual(
      staffMembershipManagementFilter(
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
        status: {
          $ne:
            "revoked",
        },
        locationAccessMode:
          "selected",
        locations: {
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
  "cross-Business staff membership access is non-disclosing",
  () => {
    assert.throws(
      () =>
        assertStaffMembershipAuthority(
          authority(),
          {
            business:
              OTHER_BUSINESS_ID,
            status:
              "active",
            roleKey:
              "manager",
            locationAccessMode:
              "selected",
            locations: [
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
  }
);

test(
  "selected-location staff membership assertion fails outside the actor scope",
  () => {
    assert.throws(
      () =>
        assertStaffMembershipAuthority(
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
            status:
              "active",
            roleKey:
              "stylist",
            locationAccessMode:
              "selected",
            locations: [
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
  "new staff membership payload derives Business and locations from trusted authority inputs",
  () => {
    assert.deepEqual(
      newStaffMembershipPayload({
        authority:
          authority({
            mode:
              "selected",
            allowed: [
              LOCATION_A,
          ],
        }),
        userId:
          USER_ID,
        roleKey:
          "Stylist",
        workingLocationIds: [
          LOCATION_A,
        ],
        actorId:
          USER_ID,
      }),
      {
        user:
          USER_ID,
        business:
          BUSINESS_ID,
        status:
          "active",
        roleKey:
          "stylist",
        locationAccessMode:
          "selected",
        locations: [
          LOCATION_A,
        ],
        isDefault:
          true,
        createdBy:
          USER_ID,
        updatedBy:
          USER_ID,
      }
    );
  }
);
