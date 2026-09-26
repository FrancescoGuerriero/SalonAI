import mongoose from "mongoose";

import {
  permissionsForRole,
} from "../../constants/permissions.js";
import {
  normaliseTenantId,
  tenantFilter,
} from "./tenantScope.js";

export const TENANT_AUTHORITY_SCOPES =
  Object.freeze([
    "business",
    "location",
    "aggregate",
  ]);

function authorityError(
  message,
  code,
  statusCode = 404
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normaliseObjectId(
  value,
  label,
  {
    code = "TENANT_RESOURCE_NOT_FOUND",
    statusCode = 404,
  } = {}
) {
  const candidate =
    value &&
    typeof value === "object" &&
    "_id" in value
      ? value._id
      : value;

  const text =
    String(candidate || "").trim();

  if (
    !mongoose.Types.ObjectId.isValid(
      text
    )
  ) {
    throw authorityError(
      `A valid ${label} id is required.`,
      code,
      statusCode
    );
  }

  return text;
}

function assertPlainObject(
  value,
  label
) {
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== "object"
  ) {
    throw authorityError(
      `${label} is required.`,
      "INVALID_TENANT_AUTHORITY",
      400
    );
  }
}

export function assertTenantAuthorityContext(
  tenantContext
) {
  assertPlainObject(
    tenantContext,
    "Trusted tenant context"
  );

  const userId =
    normaliseObjectId(
      tenantContext.userId,
      "trusted user",
      {
        code:
          "INVALID_TENANT_AUTHORITY",
        statusCode: 400,
      }
    );

  const businessId =
    normaliseTenantId(
      tenantContext.businessId
    );

  const roleKey =
    String(
      tenantContext.roleKey || ""
    )
      .trim()
      .toLowerCase();

  if (!roleKey) {
    throw authorityError(
      "Trusted tenant context is missing a role key.",
      "INVALID_TENANT_AUTHORITY",
      400
    );
  }

  const locationAccessMode =
    tenantContext.locationAccessMode ===
    "all"
      ? "all"
      : "selected";

  const allowedLocationIds =
    locationAccessMode === "all"
      ? null
      : [
          ...new Set(
            (
              Array.isArray(
                tenantContext.allowedLocationIds
              )
                ? tenantContext.allowedLocationIds
                : []
            ).map((value) =>
              normaliseObjectId(
                value,
                "allowed location"
              )
            )
          ),
        ];

  const locationId =
    tenantContext.locationId
      ? normaliseObjectId(
          tenantContext.locationId,
          "active location"
        )
      : null;

  if (
    locationId &&
    locationAccessMode ===
      "selected" &&
    !allowedLocationIds.includes(
      locationId
    )
  ) {
    throw authorityError(
      "The active location is outside the trusted membership location scope.",
      "TENANT_LOCATION_NOT_FOUND"
    );
  }

  return Object.freeze({
    userId,
    businessId,
    locationId,
    roleKey,
    locationAccessMode,
    allowedLocationIds:
      allowedLocationIds === null
        ? null
        : Object.freeze(
            allowedLocationIds
          ),
  });
}

export function permissionsForTenantContext(
  user,
  tenantContext
) {
  const context =
    assertTenantAuthorityContext(
      tenantContext
    );

  const authenticatedUserId =
    normaliseObjectId(
      user?._id || user?.id,
      "authenticated user",
      {
        code:
          "TENANT_CONTEXT_USER_MISMATCH",
        statusCode: 403,
      }
    );

  if (
    authenticatedUserId !==
    context.userId
  ) {
    throw authorityError(
      "The trusted tenant context does not belong to the authenticated user.",
      "TENANT_CONTEXT_USER_MISMATCH",
      403
    );
  }

  const legacyRole =
    String(user?.role || "")
      .trim()
      .toLowerCase();

  /*
   * Direct/role permission arrays are still stored on User in the
   * current single-tenant model. Reuse them only while the trusted
   * membership role matches that legacy role. If a future membership
   * selects a different tenant-local role, fail closed to that role's
   * baseline until tenant-local role grants are migrated explicitly.
   */
  const mayReuseLegacyGrants =
    legacyRole === context.roleKey;

  return permissionsForRole(
    context.roleKey,
    mayReuseLegacyGrants
      ? user?.permissions
      : [],
    mayReuseLegacyGrants
      ? user?.rolePermissions
      : []
  );
}

export function hasTenantPermission(
  user,
  tenantContext,
  permission
) {
  if (!permission) {
    return false;
  }

  return permissionsForTenantContext(
    user,
    tenantContext
  ).includes(permission);
}

export function requireTenantPermissions(
  ...requiredPermissions
) {
  const required = [
    ...new Set(
      requiredPermissions
        .map((value) =>
          String(value || "").trim()
        )
        .filter(Boolean)
    ),
  ];

  return function tenantPermissionMiddleware(
    request,
    response,
    next
  ) {
    try {
      if (!request?.user) {
        return response
          .status(401)
          .json({
            success: false,
            code:
              "AUTHENTICATION_REQUIRED",
            message:
              "Authentication is required.",
            requestId:
              request?.requestId,
          });
      }

      const permissions =
        permissionsForTenantContext(
          request.user,
          request.tenantContext
        );

      const missing =
        required.filter(
          (permission) =>
            !permissions.includes(
              permission
            )
        );

      if (missing.length > 0) {
        return response
          .status(403)
          .json({
            success: false,
            code:
              "INSUFFICIENT_PERMISSIONS",
            message:
              "You do not have permission to perform this action in the active business context.",
            missingPermissions:
              missing,
            requestId:
              request.requestId,
          });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function assertLocationContext(
  context
) {
  if (!context.locationId) {
    throw authorityError(
      "A trusted active location is required for this operation.",
      "TENANT_LOCATION_NOT_FOUND"
    );
  }

  if (
    context.locationAccessMode ===
      "selected" &&
    !context.allowedLocationIds.includes(
      context.locationId
    )
  ) {
    throw authorityError(
      "The active location is outside the trusted membership scope.",
      "TENANT_LOCATION_NOT_FOUND"
    );
  }

  return context.locationId;
}

function resourceBusinessId(
  resource
) {
  return normaliseObjectId(
    resource?.business,
    "resource business"
  );
}

function resourceLocationId(
  resource
) {
  return normaliseObjectId(
    resource?.location,
    "resource location"
  );
}

export function assertTenantResourceScope(
  tenantContext,
  resource,
  {
    scope = "business",
  } = {}
) {
  if (
    !TENANT_AUTHORITY_SCOPES.includes(
      scope
    ) ||
    scope === "aggregate"
  ) {
    throw authorityError(
      "Resource ownership checks require business or location scope.",
      "INVALID_TENANT_AUTHORITY",
      400
    );
  }

  const context =
    assertTenantAuthorityContext(
      tenantContext
    );

  assertPlainObject(
    resource,
    "Tenant-owned resource"
  );

  if (
    resourceBusinessId(resource) !==
    context.businessId
  ) {
    throw authorityError(
      "The requested resource does not belong to the active business.",
      "TENANT_RESOURCE_NOT_FOUND"
    );
  }

  if (scope === "location") {
    const locationId =
      assertLocationContext(
        context
      );

    if (
      resourceLocationId(
        resource
      ) !== locationId
    ) {
      throw authorityError(
        "The requested resource does not belong to the active location.",
        "TENANT_RESOURCE_NOT_FOUND"
      );
    }
  }

  return resource;
}

function assertNoCallerLocationFilter(
  filter
) {
  if (
    Object.prototype.hasOwnProperty.call(
      filter,
      "location"
    )
  ) {
    throw authorityError(
      "Location scope must be supplied by trusted tenant authority, not by the caller filter.",
      "TENANT_SCOPE_CONFLICT",
      400
    );
  }
}

export function tenantAuthorisedFilter(
  tenantContext,
  filter = {},
  {
    scope = "business",
  } = {}
) {
  if (
    !TENANT_AUTHORITY_SCOPES.includes(
      scope
    )
  ) {
    throw authorityError(
      "The requested tenant authority scope is invalid.",
      "INVALID_TENANT_AUTHORITY",
      400
    );
  }

  const context =
    assertTenantAuthorityContext(
      tenantContext
    );

  assertPlainObject(
    filter,
    "Tenant query filter"
  );

  const businessFilter =
    tenantFilter(
      context.businessId,
      filter
    );

  if (scope === "business") {
    return businessFilter;
  }

  assertNoCallerLocationFilter(
    filter
  );

  if (scope === "location") {
    return {
      ...businessFilter,
      location:
        assertLocationContext(
          context
        ),
    };
  }

  if (
    context.locationAccessMode ===
    "all"
  ) {
    return businessFilter;
  }

  return {
    ...businessFilter,
    location: {
      $in: [
        ...context.allowedLocationIds,
      ],
    },
  };
}

export function assertTenantSelfScope(
  tenantContext,
  targetUserId
) {
  const context =
    assertTenantAuthorityContext(
      tenantContext
    );

  const target =
    normaliseObjectId(
      targetUserId,
      "target user"
    );

  if (target !== context.userId) {
    throw authorityError(
      "The requested resource is outside the authenticated user's self scope.",
      "TENANT_RESOURCE_NOT_FOUND"
    );
  }

  return target;
}

export default {
  assertTenantAuthorityContext,
  permissionsForTenantContext,
  hasTenantPermission,
  requireTenantPermissions,
  assertTenantResourceScope,
  tenantAuthorisedFilter,
  assertTenantSelfScope,
};
