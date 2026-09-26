import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPLOYEE_PERMISSIONS,
} from "../constants/permissions.js";
import {
  createEffectiveAuthorityMiddleware,
  requireEffectivePermissions,
} from "../middleware/effectiveAuthorityMiddleware.js";
import {
  canUsePermissionAtCurrentScope,
  hasLocationAuthority,
  resolveEffectiveAuthority,
} from "../services/effectiveAuthorityService.js";
import {
  permissionScope,
  unclassifiedEmployeePermissions,
} from "../services/permissionScopeService.js";

function tenantContext({
  roleKey = "manager",
  locationId = null,
  mode = "selected",
  allowed = [],
} = {}) {
  return {
    userId:
      "507f1f77bcf86cd799439011",
    businessId:
      "507f1f77bcf86cd799439012",
    locationId,
    roleKey,
    locationAccessMode:
      mode,
    allowedLocationIds:
      mode === "all"
        ? null
        : allowed,
  };
}

function user({
  role = "manager",
  permissions = [],
  rolePermissions = [],
  isActive = true,
} = {}) {
  return {
    _id:
      "507f1f77bcf86cd799439011",
    role,
    permissions,
    rolePermissions,
    isActive,
  };
}

test(
  "every employee permission has an effective-authority scope classification",
  () => {
    assert.deepEqual(
      unclassifiedEmployeePermissions(),
      []
    );

    for (
      const permission
      of EMPLOYEE_PERMISSIONS
    ) {
      assert.ok(
        permissionScope(
          permission
        ),
        permission
      );
    }
  }
);

test(
  "matching built-in membership preserves the current single-tenant user grants",
  async () => {
    const authority =
      await resolveEffectiveAuthority({
        user:
          user({
            role:
              "manager",
            permissions: [
              "appointment:read",
            ],
            rolePermissions: [
              "reports:read",
            ],
          }),
        tenantContext:
          tenantContext({
            roleKey:
              "manager",
            locationId:
              "507f1f77bcf86cd799439013",
            allowed: [
              "507f1f77bcf86cd799439013",
            ],
          }),
        roleResolver:
          async () => {
            throw new Error(
              "Built-in matching-role fast path should not query the registry."
            );
          },
      });

    assert.equal(
      authority.legacyUserGrantsApplied,
      true
    );
    assert.equal(
      authority.roleSource,
      "legacy-compatible-built-in"
    );
    assert.ok(
      authority.permissions.includes(
        "dashboard:view"
      )
    );
    assert.ok(
      authority.permissions.includes(
        "appointment:read"
      )
    );
    assert.ok(
      authority.permissions.includes(
        "reports:read"
      )
    );
  }
);

test(
  "a different membership role does not inherit global User grants from another role",
  async () => {
    const authority =
      await resolveEffectiveAuthority({
        user:
          user({
            role:
              "super_admin",
            permissions: [
              "employee:permissions:update",
              "reports:manage",
            ],
          }),
        tenantContext:
          tenantContext({
            roleKey:
              "stylist",
          }),
        roleResolver:
          async (
            roleKey
          ) => ({
            key:
              roleKey,
            active:
              true,
            permissions: [
              "dashboard:view",
              "profile:own:read",
            ],
          }),
      });

    assert.equal(
      authority.roleKey,
      "stylist"
    );
    assert.equal(
      authority.legacyUserGrantsApplied,
      false
    );
    assert.deepEqual(
      authority.permissions,
      [
        "dashboard:view",
        "profile:own:read",
      ]
    );
    assert.equal(
      authority.permissions.includes(
        "employee:permissions:update"
      ),
      false
    );
  }
);

test(
  "selected memberships expose only their trusted allowed locations while all-mode remains business-bounded",
  async () => {
    const selected =
      await resolveEffectiveAuthority({
        user:
          user({
            role:
              "manager",
          }),
        tenantContext:
          tenantContext({
            roleKey:
              "manager",
            locationId:
              "507f1f77bcf86cd799439013",
            allowed: [
              "507f1f77bcf86cd799439013",
              "507f1f77bcf86cd799439014",
            ],
          }),
      });

    assert.equal(
      hasLocationAuthority(
        selected,
        "507f1f77bcf86cd799439013"
      ),
      true
    );
    assert.equal(
      hasLocationAuthority(
        selected,
        "507f1f77bcf86cd799439014"
      ),
      true
    );
    assert.equal(
      hasLocationAuthority(
        selected,
        "507f1f77bcf86cd799439099"
      ),
      false
    );

    const allMode =
      await resolveEffectiveAuthority({
        user:
          user({
            role:
              "manager",
          }),
        tenantContext:
          tenantContext({
            roleKey:
              "manager",
            mode:
              "all",
          }),
      });

    assert.equal(
      allMode.allowedLocationIds,
      null
    );
    assert.equal(
      hasLocationAuthority(
        allMode,
        "507f1f77bcf86cd799439099"
      ),
      true
    );
  }
);

test(
  "location-scoped permission fails closed without a trusted selected location",
  async () => {
    const authority =
      await resolveEffectiveAuthority({
        user:
          user({
            role:
              "manager",
            permissions: [
              "appointment:read",
            ],
          }),
        tenantContext:
          tenantContext({
            roleKey:
              "manager",
            locationId:
              null,
          }),
      });

    assert.equal(
      canUsePermissionAtCurrentScope(
        authority,
        "appointment:read"
      ),
      false
    );

    assert.equal(
      canUsePermissionAtCurrentScope(
        authority,
        "dashboard:view"
      ),
      true
    );
  }
);

test(
  "unknown tenant role fails closed",
  async () => {
    await assert.rejects(
      () =>
        resolveEffectiveAuthority({
          user:
            user({
              role:
                "manager",
            }),
          tenantContext:
            tenantContext({
              roleKey:
                "custom_missing",
            }),
          roleResolver:
            async () =>
              null,
        }),
      (error) =>
        error?.code ===
          "TENANT_ROLE_UNAVAILABLE" &&
        error?.statusCode ===
          403
    );
  }
);

test(
  "middleware attaches only authority derived from user plus trusted tenant context",
  async () => {
    const request = {
      user:
        user(),
      tenantContext:
        tenantContext({
          locationId:
            "507f1f77bcf86cd799439013",
        }),
      body: {
        businessId:
          "507f1f77bcf86cd799439099",
        locationId:
          "507f1f77bcf86cd799439098",
      },
      query: {
        businessId:
          "507f1f77bcf86cd799439097",
      },
      headers: {
        "x-business-id":
          "507f1f77bcf86cd799439096",
      },
    };

    const middleware =
      createEffectiveAuthorityMiddleware({
        authorityResolver:
          async ({
            user:
              resolvedUser,
            tenantContext:
              resolvedContext,
          }) => ({
            userId:
              String(
                resolvedUser._id
              ),
            businessId:
              resolvedContext.businessId,
            locationId:
              resolvedContext.locationId,
            roleKey:
              resolvedContext.roleKey,
            permissions: [
              "appointment:read",
            ],
          }),
      });

    await new Promise(
      (resolve, reject) => {
        middleware(
          request,
          {},
          (error) => {
            if (error) {
              reject(
                error
              );
              return;
            }
            resolve();
          }
        );
      }
    );

    assert.equal(
      request
        .effectiveAuthority
        .businessId,
      request.tenantContext
        .businessId
    );
    assert.equal(
      request
        .effectiveAuthority
        .locationId,
      request.tenantContext
        .locationId
    );
    assert.notEqual(
      request
        .effectiveAuthority
        .businessId,
      request.body
        .businessId
    );
  }
);

test(
  "effective permission middleware enforces location scope",
  async () => {
    const middleware =
      requireEffectivePermissions(
        "appointment:read"
      );

    const failure =
      await new Promise(
        (resolve) => {
          middleware(
            {
              effectiveAuthority: {
                permissions: [
                  "appointment:read",
                ],
                locationId:
                  null,
              },
            },
            {},
            (error) =>
              resolve(
                error
              )
          );
        }
      );

    assert.equal(
      failure?.code,
      "LOCATION_CONTEXT_REQUIRED"
    );

    const success =
      await new Promise(
        (resolve) => {
          middleware(
            {
              effectiveAuthority: {
                permissions: [
                  "appointment:read",
                ],
                locationId:
                  "507f1f77bcf86cd799439013",
              },
            },
            {},
            (error) =>
              resolve(
                error ||
                null
              )
          );
        }
      );

    assert.equal(
      success,
      null
    );
  }
);
