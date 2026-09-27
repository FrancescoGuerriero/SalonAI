import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveEffectiveTenantProductComposition,
} from "../platform/productComposition/tenantProductManifest.js";
import {
  assertOperationAccess,
  assertTrustedCapabilityDecision,
  capabilityDecisionFromComposition,
} from "../services/operationAccessService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439012";
const OTHER_BUSINESS_ID =
  "507f1f77bcf86cd799439099";

function authority({
  permissions = [
    "reports:read",
  ],
  businessId =
    BUSINESS_ID,
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

function composition({
  businessId =
    BUSINESS_ID,
  platformDisabledCapabilityPackKeys =
    [],
} = {}) {
  return resolveEffectiveTenantProductComposition({
    manifest: {
      schemaVersion:
        "1",
      platformVersion:
        "3.0.0",
      businessId,
      verticalId:
        "salon",
      capabilityPackKeys:
        [],
      manifestRevision:
        "1",
      status:
        "active",
    },
    platformDisabledCapabilityPackKeys,
  });
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
          businessId:
            BUSINESS_ID,
          allowed:
            true,
          source:
            "effective-composition",
        },
        resource: {
          businessId:
            BUSINESS_ID,
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
      grant.capability.businessId,
      BUSINESS_ID
    );
    assert.equal(
      grant.capability.source,
      "effective-composition"
    );
    assert.equal(
      grant.resource.businessId,
      BUSINESS_ID
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
            businessId:
              BUSINESS_ID,
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
            businessId:
              BUSINESS_ID,
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
  "malformed or unbound capability decisions fail closed",
  () => {
    assert.throws(
      () =>
        assertTrustedCapabilityDecision(
          true,
          {
            authority:
              authority(),
          }
        ),
      (error) =>
        error?.code ===
          "INVALID_CAPABILITY_DECISION" &&
        error?.statusCode ===
          500
    );

    assert.throws(
      () =>
        assertTrustedCapabilityDecision(
          {
            key:
              "analytics",
            allowed:
              true,
          },
          {
            authority:
              authority(),
          }
        ),
      (error) =>
        error?.code ===
          "INVALID_CAPABILITY_DECISION"
    );
  }
);

test(
  "cross-business capability decisions use non-disclosing resource denial",
  () => {
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
            businessId:
              OTHER_BUSINESS_ID,
            allowed:
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
              OTHER_BUSINESS_ID,
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
            BUSINESS_ID,
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
              BUSINESS_ID,
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

test(
  "merged tenant product composition produces a business-bound trusted capability decision",
  () => {
    const decision =
      capabilityDecisionFromComposition({
        authority:
          authority(),
        composition:
          composition(),
        capability:
          "analytics",
      });

    assert.deepEqual(
      decision,
      {
        key:
          "analytics",
        businessId:
          BUSINESS_ID,
        allowed:
          true,
        source:
          "vertical-default",
        verticalId:
          "salon",
        manifestRevision:
          "1",
      }
    );
  }
);

test(
  "tenant product composition from another business cannot grant capability access",
  () => {
    assert.throws(
      () =>
        capabilityDecisionFromComposition({
          authority:
            authority(),
          composition:
            composition({
              businessId:
                OTHER_BUSINESS_ID,
            }),
          capability:
            "analytics",
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
  "platform-disabled and unselected capabilities fail closed",
  () => {
    assert.throws(
      () =>
        capabilityDecisionFromComposition({
          authority:
            authority(),
          composition:
            composition({
              platformDisabledCapabilityPackKeys: [
                "analytics",
              ],
            }),
          capability:
            "analytics",
        }),
      (error) =>
        error?.code ===
          "CAPABILITY_UNAVAILABLE" &&
        error?.statusCode ===
          404
    );

    assert.throws(
      () =>
        capabilityDecisionFromComposition({
          authority:
            authority(),
          composition:
            composition(),
          capability:
            "clinical-records",
        }),
      (error) =>
        error?.code ===
          "CAPABILITY_UNAVAILABLE" &&
        error?.statusCode ===
          404
    );
  }
);
