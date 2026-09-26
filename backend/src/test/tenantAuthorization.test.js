import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  assertTenantAuthorityContext,
  assertTenantResourceScope,
  assertTenantSelfScope,
  hasTenantPermission,
  permissionsForTenantContext,
  requireTenantPermissions,
  tenantAuthorisedFilter,
} from "../platform/tenancy/tenantAuthorization.js";

function ids() {
  return {
    userId:
      new mongoose.Types.ObjectId(),
    otherUserId:
      new mongoose.Types.ObjectId(),
    businessId:
      new mongoose.Types.ObjectId(),
    otherBusinessId:
      new mongoose.Types.ObjectId(),
    locationA:
      new mongoose.Types.ObjectId(),
    locationB:
      new mongoose.Types.ObjectId(),
  };
}

function tenantContext({
  userId,
  businessId,
  locationId = null,
  roleKey = "receptionist",
  locationAccessMode = "selected",
  allowedLocationIds = [],
}) {
  return {
    userId,
    businessId,
    locationId,
    roleKey,
    locationAccessMode,
    allowedLocationIds:
      locationAccessMode === "all"
        ? null
        : allowedLocationIds,
  };
}

test("tenant permissions use the trusted membership role instead of a broader legacy User role", () => {
  const {
    userId,
    businessId,
  } = ids();

  const user = {
    _id: userId,
    role: "super_admin",
    permissions: [
      "employee:update",
      "feature-control:update",
    ],
    rolePermissions: [
      "reports:manage",
    ],
  };

  const context =
    tenantContext({
      userId,
      businessId,
      roleKey: "receptionist",
    });

  const permissions =
    permissionsForTenantContext(
      user,
      context
    );

  assert.deepEqual(
    permissions,
    [
      "dashboard:view",
    ]
  );

  assert.equal(
    hasTenantPermission(
      user,
      context,
      "employee:update"
    ),
    false
  );
});

test("matching legacy role can reuse existing direct and role permissions during migration", () => {
  const {
    userId,
    businessId,
  } = ids();

  const user = {
    _id: userId,
    role: "stylist",
    permissions: [
      "appointment:create",
    ],
    rolePermissions: [
      "service:read",
    ],
  };

  const permissions =
    permissionsForTenantContext(
      user,
      tenantContext({
        userId,
        businessId,
        roleKey: "stylist",
      })
    );

  assert.ok(
    permissions.includes(
      "dashboard:view"
    )
  );
  assert.ok(
    permissions.includes(
      "appointment:create"
    )
  );
  assert.ok(
    permissions.includes(
      "service:read"
    )
  );
});

test("trusted super-admin membership receives the existing super-admin permission baseline", () => {
  const {
    userId,
    businessId,
  } = ids();

  const user = {
    _id: userId,
    role: "admin",
    permissions: [],
    rolePermissions: [],
  };

  const context =
    tenantContext({
      userId,
      businessId,
      roleKey: "super_admin",
      locationAccessMode: "all",
    });

  assert.equal(
    hasTenantPermission(
      user,
      context,
      "employee:delete"
    ),
    false,
    "Unknown permissions must still fail closed."
  );

  assert.equal(
    hasTenantPermission(
      user,
      context,
      "employee:update"
    ),
    true
  );
  assert.equal(
    hasTenantPermission(
      user,
      context,
      "feature-control:update"
    ),
    true
  );
});

test("tenant permission evaluation rejects a context bound to a different authenticated user", () => {
  const {
    userId,
    otherUserId,
    businessId,
  } = ids();

  assert.throws(
    () =>
      permissionsForTenantContext(
        {
          _id: otherUserId,
          role: "receptionist",
        },
        tenantContext({
          userId,
          businessId,
          roleKey:
            "receptionist",
        })
      ),
    (error) =>
      error.code ===
        "TENANT_CONTEXT_USER_MISMATCH" &&
      error.statusCode === 403
  );
});

test("business-scoped resource ownership returns 404 semantics across tenants", () => {
  const {
    userId,
    businessId,
    otherBusinessId,
  } = ids();

  const context =
    tenantContext({
      userId,
      businessId,
      locationAccessMode:
        "all",
    });

  const owned = {
    _id:
      new mongoose.Types.ObjectId(),
    business: businessId,
  };

  assert.equal(
    assertTenantResourceScope(
      context,
      owned,
      {
        scope: "business",
      }
    ),
    owned
  );

  assert.throws(
    () =>
      assertTenantResourceScope(
        context,
        {
          ...owned,
          business:
            otherBusinessId,
        },
        {
          scope:
            "business",
        }
      ),
    (error) =>
      error.code ===
        "TENANT_RESOURCE_NOT_FOUND" &&
      error.statusCode === 404
  );
});

test("location-scoped ownership requires the active trusted location", () => {
  const {
    userId,
    businessId,
    locationA,
    locationB,
  } = ids();

  const context =
    tenantContext({
      userId,
      businessId,
      locationId: locationA,
      roleKey: "manager",
      allowedLocationIds: [
        locationA,
      ],
    });

  const resource = {
    _id:
      new mongoose.Types.ObjectId(),
    business: businessId,
    location: locationA,
  };

  assert.equal(
    assertTenantResourceScope(
      context,
      resource,
      {
        scope: "location",
      }
    ),
    resource
  );

  assert.throws(
    () =>
      assertTenantResourceScope(
        context,
        {
          ...resource,
          location:
            locationB,
        },
        {
          scope:
            "location",
        }
      ),
    (error) =>
      error.code ===
        "TENANT_RESOURCE_NOT_FOUND" &&
      error.statusCode === 404
  );

  assert.throws(
    () =>
      assertTenantResourceScope(
        tenantContext({
          userId,
          businessId,
          locationId: null,
          roleKey:
            "manager",
          allowedLocationIds: [
            locationA,
          ],
        }),
        resource,
        {
          scope:
            "location",
        }
      ),
    (error) =>
      error.code ===
        "TENANT_LOCATION_NOT_FOUND" &&
      error.statusCode === 404
  );
});

test("selected-location aggregate filters are restricted to the trusted allow-list", () => {
  const {
    userId,
    businessId,
    locationA,
    locationB,
  } = ids();

  const context =
    tenantContext({
      userId,
      businessId,
      roleKey: "manager",
      allowedLocationIds: [
        locationA,
        locationB,
      ],
    });

  assert.deepEqual(
    tenantAuthorisedFilter(
      context,
      {
        status: "active",
      },
      {
        scope:
          "aggregate",
      }
    ),
    {
      status: "active",
      business:
        String(businessId),
      location: {
        $in: [
          String(locationA),
          String(locationB),
        ],
      },
    }
  );
});

test("all-location aggregate filters remain inside the trusted Business boundary", () => {
  const {
    userId,
    businessId,
  } = ids();

  assert.deepEqual(
    tenantAuthorisedFilter(
      tenantContext({
        userId,
        businessId,
        roleKey: "admin",
        locationAccessMode:
          "all",
      }),
      {
        status: "active",
      },
      {
        scope:
          "aggregate",
      }
    ),
    {
      status: "active",
      business:
        String(businessId),
    }
  );
});

test("location filters cannot be supplied by caller data for a location-scoped query", () => {
  const {
    userId,
    businessId,
    locationA,
    locationB,
  } = ids();

  assert.throws(
    () =>
      tenantAuthorisedFilter(
        tenantContext({
          userId,
          businessId,
          locationId:
            locationA,
          roleKey:
            "receptionist",
          allowedLocationIds: [
            locationA,
          ],
        }),
        {
          location:
            locationB,
        },
        {
          scope:
            "location",
        }
      ),
    (error) =>
      error.code ===
        "TENANT_SCOPE_CONFLICT" &&
      error.statusCode === 400
  );
});

test("AI or other domain queries cannot use permission to escape trusted location scope", () => {
  const {
    userId,
    businessId,
    locationA,
  } = ids();

  const user = {
    _id: userId,
    role: "stylist",
    permissions: [
      "ai:use",
    ],
    rolePermissions: [],
  };

  const context =
    tenantContext({
      userId,
      businessId,
      locationId: locationA,
      roleKey: "stylist",
      allowedLocationIds: [
        locationA,
      ],
    });

  assert.equal(
    hasTenantPermission(
      user,
      context,
      "ai:use"
    ),
    true
  );

  assert.deepEqual(
    tenantAuthorisedFilter(
      context,
      {
        modelStatus:
          "active",
      },
      {
        scope:
          "location",
      }
    ),
    {
      modelStatus:
        "active",
      business:
        String(businessId),
      location:
        String(locationA),
    }
  );
});

test("self scope is bound to the authenticated membership user", () => {
  const {
    userId,
    otherUserId,
    businessId,
  } = ids();

  const context =
    tenantContext({
      userId,
      businessId,
      roleKey: "stylist",
    });

  assert.equal(
    assertTenantSelfScope(
      context,
      userId
    ),
    String(userId)
  );

  assert.throws(
    () =>
      assertTenantSelfScope(
        context,
        otherUserId
      ),
    (error) =>
      error.code ===
        "TENANT_RESOURCE_NOT_FOUND" &&
      error.statusCode === 404
  );
});

test("tenant permission middleware requires both authenticated user and trusted tenant authority", () => {
  const {
    userId,
    businessId,
  } = ids();

  const middleware =
    requireTenantPermissions(
      "dashboard:view"
    );

  const responses = [];
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      responses.push({
        statusCode:
          this.statusCode,
        body,
      });
      return this;
    },
  };

  let nextCalls = 0;
  let nextError = null;

  middleware(
    {
      user: {
        _id: userId,
        role:
          "receptionist",
        permissions: [],
        rolePermissions: [],
      },
      tenantContext:
        tenantContext({
          userId,
          businessId,
          roleKey:
            "receptionist",
        }),
    },
    response,
    (error) => {
      nextCalls += 1;
      nextError =
        error || null;
    }
  );

  assert.equal(
    responses.length,
    0
  );
  assert.equal(nextCalls, 1);
  assert.equal(nextError, null);

  const deniedResponses = [];
  middleware(
    {
      user: {
        _id:
          new mongoose.Types.ObjectId(),
        role:
          "receptionist",
      },
      tenantContext:
        tenantContext({
          userId,
          businessId,
          roleKey:
            "receptionist",
        }),
    },
    {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        deniedResponses.push({
          statusCode:
            this.statusCode,
          body,
        });
        return this;
      },
    },
    (error) => {
      nextError =
        error || null;
    }
  );

  assert.ok(nextError);
  assert.equal(
    nextError.code,
    "TENANT_CONTEXT_USER_MISMATCH"
  );
});

test("trusted tenant context normalization keeps selected allow-list fail closed", () => {
  const {
    userId,
    businessId,
    locationA,
  } = ids();

  assert.throws(
    () =>
      assertTenantAuthorityContext({
        userId,
        businessId,
        locationId:
          locationA,
        roleKey: "manager",
        locationAccessMode:
          "selected",
        allowedLocationIds: [],
      }),
    (error) =>
      error.code ===
        "TENANT_LOCATION_NOT_FOUND" &&
      error.statusCode === 404
  );
});
