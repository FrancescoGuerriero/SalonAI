import assert from "node:assert/strict";
import test from "node:test";

import {
  assertOperationAccess,
  assertTrustedCapabilityDecision,
} from "../services/operationAccessService.js";

function authority({
  permissions = [
    "reports:read",
  ],
  businessId =
    "507f1f77bcf86cd799439012",
  locationId = null,
  locationAccessMode =
    "all",
  allowedLocationIds =
    null,
} = {}) {
  return {
    userId:
      "507f1f77bcf86cd799439011",
    roleKey:
      "manager",
    permissions,
    businessId,
    locationId,
    locationAccessMode,
    allowedLocationIds,
  };
}

test(
  "operation access composes permission, trusted capability and business resource authority",
  () => {
    const grant =
      assertOperationAccess({
        authority:
          authority(),
        permission:
          "reports:read",
        capabilityDecision: {
          key:
            "analytics",
          allowed:
            true,
          source:
            "effective-configuration",
        },
        resource: {
          businessId:
            "507f1f77bcf86cd799439012",
        },
      });

    assert.equal(
      grant.permission,
      "reports:read"
    );
    assert.equal(
      grant.capability.key,
      "analytics"
    );
    assert.equal(
      grant.capability.source,
      "effective-configuration"
    );
    assert.equal(
      grant.resource.businessId,
      "507f1f77bcf86cd799439012"
    );
  }
);

test(
  "operation access keeps capability decisions separate from permission authority",
  () => {
    assert.throws(
      () =>
        assertOperationAccess({
          authority:
            authority({
              permissions: [],
            }),
          permission:
            "reports:read",
          capabilityDecision: {
            key:
              "analytics",
            allowed:
              true,
          },
        }),
      (error) =>
        error?.code ===
          "INSUFFICIENT_PERMISSIONS" &&
        error?.statusCode ===
          403
    );

    assert.throws(
      () =>
        assertOperationAccess({
          authority:
            authority(),
          permission:
            "reports:read",
          capabilityDecision: {
            key:
              "analytics",
            allowed:
              false,
          },
        }),
      (error) =>
        error?.code ===
          "CAPABILITY_UNAVAILABLE" &&
        error?.statusCode ===
          404
    );
  }
);

test(
  "operation access does not invent an entitlement resolver",
  () => {
    const grant =
      assertOperationAccess({
        authority:
          authority(),
        permission:
          "reports:read",
      });

    assert.equal(
      grant.capability,
      null
    );
    assert.equal(
      grant.resource,
      null
    );
  }
);

test(
  "malformed capability decisions fail closed",
  () => {
    assert.throws(
      () =>
        assertTrustedCapabilityDecision(
          true
        ),
      (error) =>
        error?.code ===
          "INVALID_CAPABILITY_DECISION" &&
        error?.statusCode ===
          500
    );

    assert.throws(
      () =>
        assertTrustedCapabilityDecision({
          allowed:
            true,
        }),
      (error) =>
        error?.code ===
          "INVALID_CAPABILITY_DECISION"
    );
  }
);

test(
  "operation access applies non-disclosing business resource denial",
  () => {
    assert.throws(
      () =>
        assertOperationAccess({
          authority:
            authority(),
          permission:
            "reports:read",
          resource: {
            businessId:
              "507f1f77bcf86cd799439099",
          },
        }),
      (error) =>
        error?.code ===
          "RESOURCE_NOT_FOUND" &&
        error?.statusCode ===
          404
    );
  }
);

test(
  "operation access can require the active selected location",
  () => {
    const selected =
      authority({
        permissions: [
          "appointment:read",
        ],
        locationId:
          "507f1f77bcf86cd799439013",
        locationAccessMode:
          "selected",
        allowedLocationIds: [
          "507f1f77bcf86cd799439013",
          "507f1f77bcf86cd799439014",
        ],
      });

    const grant =
      assertOperationAccess({
        authority:
          selected,
        permission:
          "appointment:read",
        resource: {
          businessId:
            "507f1f77bcf86cd799439012",
          locationId:
            "507f1f77bcf86cd799439013",
          requireSelectedLocation:
            true,
        },
      });

    assert.equal(
      grant.resource.locationId,
      "507f1f77bcf86cd799439013"
    );

    assert.throws(
      () =>
        assertOperationAccess({
          authority:
            selected,
          permission:
            "appointment:read",
          resource: {
            businessId:
              "507f1f77bcf86cd799439012",
            locationId:
              "507f1f77bcf86cd799439014",
            requireSelectedLocation:
              true,
          },
        }),
      (error) =>
        error?.code ===
          "RESOURCE_NOT_FOUND" &&
        error?.statusCode ===
          404
    );
  }
);
