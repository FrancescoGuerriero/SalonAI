import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  assertNoUnscopedRotaStaffReassignment,
  assertRotaShiftMutationRecord,
} from "../services/staffRotaMutationAuthorityService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439012";
const OTHER_BUSINESS_ID =
  "507f1f77bcf86cd799439099";
const LOCATION_A =
  "507f1f77bcf86cd799439013";
const LOCATION_B =
  "507f1f77bcf86cd799439014";
const STAFF_A =
  "507f1f77bcf86cd799439021";
const STAFF_B =
  "507f1f77bcf86cd799439022";

function authority({
  mode = "selected",
  allowed = [LOCATION_A],
} = {}) {
  return {
    businessId: BUSINESS_ID,
    locationAccessMode: mode,
    allowedLocationIds:
      mode === "all"
        ? null
        : allowed,
  };
}

test(
  "existing rota mutation accepts only trusted Business and allowed Location",
  () => {
    assert.deepEqual(
      assertRotaShiftMutationRecord(
        authority(),
        {
          business: BUSINESS_ID,
          locationRef: LOCATION_A,
          staff: STAFF_A,
        }
      ),
      {
        businessId: BUSINESS_ID,
        locationId: LOCATION_A,
      }
    );
  }
);

test(
  "cross-Business rota mutation fails non-disclosing",
  () => {
    assert.throws(
      () =>
        assertRotaShiftMutationRecord(
          authority(),
          {
            business: OTHER_BUSINESS_ID,
            locationRef: LOCATION_A,
            staff: STAFF_A,
          }
        ),
      (error) =>
        error?.code === "RESOURCE_NOT_FOUND" &&
        error?.statusCode === 404
    );
  }
);

test(
  "selected-location rota mutation cannot target another Location",
  () => {
    assert.throws(
      () =>
        assertRotaShiftMutationRecord(
          authority(),
          {
            business: BUSINESS_ID,
            locationRef: LOCATION_B,
            staff: STAFF_A,
          }
        ),
      (error) =>
        error?.code === "RESOURCE_NOT_FOUND" &&
        error?.statusCode === 404
    );
  }
);

test(
  "selected-location rota mutation fails closed when trusted locationRef is missing",
  () => {
    assert.throws(
      () =>
        assertRotaShiftMutationRecord(
          authority(),
          {
            business: BUSINESS_ID,
            staff: STAFF_A,
          }
        ),
      (error) =>
        error?.code === "RESOURCE_NOT_FOUND" &&
        error?.statusCode === 404
    );
  }
);

test(
  "all-location authority remains bounded to the trusted Business",
  () => {
    assert.deepEqual(
      assertRotaShiftMutationRecord(
        authority({ mode: "all" }),
        {
          business: BUSINESS_ID,
          locationRef: LOCATION_B,
          staff: STAFF_A,
        }
      ),
      {
        businessId: BUSINESS_ID,
        locationId: LOCATION_B,
      }
    );

    assert.throws(
      () =>
        assertRotaShiftMutationRecord(
          authority({ mode: "all" }),
          {
            business: OTHER_BUSINESS_ID,
            locationRef: LOCATION_B,
            staff: STAFF_A,
          }
        ),
      (error) =>
        error?.code === "RESOURCE_NOT_FOUND"
    );
  }
);

test(
  "legacy rota mutation path rejects staff reassignment outside a scoped workflow",
  () => {
    assert.equal(
      assertNoUnscopedRotaStaffReassignment(
        {},
        STAFF_A
      ),
      true
    );

    assert.equal(
      assertNoUnscopedRotaStaffReassignment(
        { staffId: STAFF_A },
        STAFF_A
      ),
      true
    );

    assert.throws(
      () =>
        assertNoUnscopedRotaStaffReassignment(
          { staffId: STAFF_B },
          STAFF_A
        ),
      (error) =>
        error?.code ===
          "ROTA_STAFF_REASSIGNMENT_REQUIRES_SCOPED_WORKFLOW" &&
        error?.statusCode === 409
    );
  }
);

test(
  "existing-record rota mutation routes attach tenant authority before schedule permission and record guard",
  async () => {
    const routes = await readFile(
      new URL(
        "../features/staffRota/staffRotaRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(
      routes,
      /workforcePublicTenantContextMiddleware/
    );
    assert.match(
      routes,
      /trustedTenantContextMiddleware/
    );
    assert.match(
      routes,
      /effectiveAuthorityMiddleware/
    );
    assert.match(
      routes,
      /requireScopedRotaShiftMutation/
    );
    assert.match(
      routes,
      /const scopedExistingShiftMutation = \[\s*\.\.\.rotaTenantAuthority,\s*manageRota,\s*asyncHandler\(\s*requireScopedRotaShiftMutation\s*\)/s
    );

    for (const path of [
      '\"/shifts/:shiftId\"',
      '\"/shifts/:shiftId/clock-in\"',
      '\"/shifts/:shiftId/clock-out\"',
      '\"/shifts/:shiftId/attendance\"',
    ]) {
      assert.match(
        routes,
        new RegExp(
          `${path},[\\s\\S]{0,160}\\.\\.\\.scopedExistingShiftMutation`
        )
      );
    }
  }
);
