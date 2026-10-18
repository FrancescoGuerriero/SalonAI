import {
  EMPLOYEE_PERMISSION_SET,
  permissionsForRole,
} from "../constants/permissions.js";
import {
  isBuiltInStaffRoleKey,
} from "./staffRoleRegistryService.js";
import {
  resolveTenantStaffRole,
} from "./tenantStaffRoleRegistryService.js";
import {
  PERMISSION_SCOPE_CLASSES,
  permissionScope,
} from "./permissionScopeService.js";

function authorityError(
  message,
  code,
  statusCode = 403
) {
  const error = new Error(
    message
  );
  error.code = code;
  error.statusCode =
    statusCode;
  return error;
}

function text(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function idText(value) {
  const candidate =
    value &&
    typeof value ===
      "object" &&
    "_id" in value
      ? value._id
      : value;

  return String(
    candidate || ""
  ).trim();
}

function normalisedIds(
  values
) {
  return [
    ...new Set(
      (
        Array.isArray(
          values
        )
          ? values
          : []
      )
        .map(
          idText
        )
        .filter(
          Boolean
        )
    ),
  ];
}

function normalisedPermissions(
  values
) {
  return [
    ...new Set(
      (
        Array.isArray(
          values
        )
          ? values
          : []
      )
        .map(
          (permission) =>
            String(
              permission || ""
            ).trim()
        )
        .filter(
          (permission) =>
            EMPLOYEE_PERMISSION_SET.has(
              permission
            )
        )
    ),
  ];
}

async function permissionsForTenantRole({
  user,
  roleKey,
  businessId,
  legacyUserGrantsEligible,
  roleResolver,
}) {
  const userRole =
    text(
      user?.role
    );
  const roleMatchesLegacyUser =
    userRole === roleKey;

  if (
    legacyUserGrantsEligible &&
    roleMatchesLegacyUser &&
    isBuiltInStaffRoleKey(
      roleKey
    )
  ) {
    return {
      permissions:
        permissionsForRole(
          roleKey,
          user?.permissions,
          user?.rolePermissions
        ),
      roleMatchesLegacyUser,
      legacyUserGrantsApplied:
        true,
      roleSource:
        "legacy-compatible-built-in",
    };
  }

  const definition =
    await roleResolver(
      roleKey,
      {
        activeOnly:
          true,
        businessId:
          idText(
            businessId
          ),
      }
    );

  if (
    !definition ||
    definition.active ===
      false
  ) {
    throw authorityError(
      "The active business membership references an unavailable staff role.",
      "TENANT_ROLE_UNAVAILABLE"
    );
  }

  const registryPermissions =
    normalisedPermissions(
      definition.permissions
    );

  const permissions =
    legacyUserGrantsEligible &&
    roleMatchesLegacyUser
      ? normalisedPermissions([
          ...registryPermissions,
          ...(Array.isArray(
            user?.rolePermissions
          )
            ? user.rolePermissions
            : []),
          ...(Array.isArray(
            user?.permissions
          )
            ? user.permissions
            : []),
        ])
      : registryPermissions;

  return {
    permissions,
    roleMatchesLegacyUser,
    legacyUserGrantsApplied:
      legacyUserGrantsEligible &&
      roleMatchesLegacyUser,
    roleSource:
      "staff-role-registry",
  };
}

export async function resolveEffectiveAuthority({
  user,
  tenantContext,
  roleResolver =
    resolveTenantStaffRole,
}) {
  if (
    !user ||
    user.isActive ===
      false
  ) {
    throw authorityError(
      "An active authenticated user is required.",
      "EFFECTIVE_AUTHENTICATION_REQUIRED",
      401
    );
  }

  if (
    !tenantContext ||
    !tenantContext.businessId ||
    !tenantContext.roleKey
  ) {
    throw authorityError(
      "Trusted tenant context is required before effective authority can be resolved.",
      "TRUSTED_TENANT_CONTEXT_REQUIRED",
      401
    );
  }

  if (
    typeof roleResolver !==
    "function"
  ) {
    throw authorityError(
      "The staff role resolver is unavailable.",
      "EFFECTIVE_AUTHORITY_CONFIGURATION_ERROR",
      500
    );
  }

  const roleKey =
    text(
      tenantContext.roleKey
    );

  const result =
    await permissionsForTenantRole({
      user,
      roleKey,
      businessId:
        tenantContext.businessId,
      legacyUserGrantsEligible:
        tenantContext
          .legacyUserGrantsEligible ===
        true,
      roleResolver,
    });

  const authority =
    {
      userId:
        idText(
          user._id ||
            user.id
        ),
      businessId:
        idText(
          tenantContext.businessId
        ),
      locationId:
        tenantContext.locationId
          ? idText(
              tenantContext.locationId
            )
          : null,
      roleKey,
      locationAccessMode:
        tenantContext.locationAccessMode ===
        "all"
          ? "all"
          : "selected",
      allowedLocationIds:
        tenantContext.allowedLocationIds ===
        null
          ? null
          : Object.freeze(
              normalisedIds(
                tenantContext.allowedLocationIds
              )
            ),
      permissions:
        Object.freeze(
          [...result.permissions]
        ),
      roleMatchesLegacyUser:
        result.roleMatchesLegacyUser,
      legacyUserGrantsEligible:
        tenantContext
          .legacyUserGrantsEligible ===
        true,
      legacyUserGrantsApplied:
        result.legacyUserGrantsApplied,
      roleSource:
        result.roleSource,
    };

  return Object.freeze(
    authority
  );
}

export function hasEffectivePermission(
  authority,
  permission
) {
  return Boolean(
    authority &&
    Array.isArray(
      authority.permissions
    ) &&
    authority.permissions.includes(
      permission
    )
  );
}

export function hasLocationAuthority(
  authority,
  locationId
) {
  const targetLocationId =
    idText(
      locationId
    );

  if (
    !authority ||
    !targetLocationId
  ) {
    return false;
  }

  if (
    authority.locationAccessMode ===
    "all"
  ) {
    return true;
  }

  return Boolean(
    Array.isArray(
      authority.allowedLocationIds
    ) &&
    authority.allowedLocationIds.includes(
      targetLocationId
    )
  );
}

export function hasBusinessResourceAuthority(
  authority,
  businessId
) {
  const targetBusinessId =
    idText(
      businessId
    );

  return Boolean(
    authority &&
    targetBusinessId &&
    idText(
      authority.businessId
    ) === targetBusinessId
  );
}

export function hasLocationResourceAuthority(
  authority,
  {
    businessId,
    locationId,
    requireSelectedLocation =
      false,
  } = {}
) {
  const targetLocationId =
    idText(
      locationId
    );

  if (
    !hasBusinessResourceAuthority(
      authority,
      businessId
    ) ||
    !targetLocationId ||
    !hasLocationAuthority(
      authority,
      targetLocationId
    )
  ) {
    return false;
  }

  if (
    requireSelectedLocation
  ) {
    return Boolean(
      authority.locationId &&
      idText(
        authority.locationId
      ) === targetLocationId
    );
  }

  return true;
}

function resourceNotFoundError() {
  return authorityError(
    "The requested resource was not found.",
    "RESOURCE_NOT_FOUND",
    404
  );
}

export function assertBusinessResourceAuthority(
  authority,
  businessId
) {
  if (
    !hasBusinessResourceAuthority(
      authority,
      businessId
    )
  ) {
    throw resourceNotFoundError();
  }

  return {
    businessId:
      idText(
        businessId
      ),
  };
}

export function assertLocationResourceAuthority(
  authority,
  {
    businessId,
    locationId,
    requireSelectedLocation =
      false,
  } = {}
) {
  if (
    !hasLocationResourceAuthority(
      authority,
      {
        businessId,
        locationId,
        requireSelectedLocation,
      }
    )
  ) {
    throw resourceNotFoundError();
  }

  return {
    businessId:
      idText(
        businessId
      ),
    locationId:
      idText(
        locationId
      ),
    requireSelectedLocation:
      Boolean(
        requireSelectedLocation
      ),
  };
}

export function canUsePermissionAtCurrentScope(
  authority,
  permission
) {
  if (
    !hasEffectivePermission(
      authority,
      permission
    )
  ) {
    return false;
  }

  const scope =
    permissionScope(
      permission
    );

  if (!scope) {
    return false;
  }

  if (
    scope ===
      PERMISSION_SCOPE_CLASSES.LOCATION &&
    !authority.locationId
  ) {
    return false;
  }

  return true;
}

export function assertEffectivePermission(
  authority,
  permission
) {
  if (
    !hasEffectivePermission(
      authority,
      permission
    )
  ) {
    throw authorityError(
      "You do not have permission to perform this action.",
      "INSUFFICIENT_PERMISSIONS"
    );
  }

  const scope =
    permissionScope(
      permission
    );

  if (!scope) {
    throw authorityError(
      "This permission has no effective-authority scope classification.",
      "UNCLASSIFIED_PERMISSION",
      500
    );
  }

  if (
    scope ===
      PERMISSION_SCOPE_CLASSES.LOCATION &&
    !authority.locationId
  ) {
    throw authorityError(
      "A trusted active location is required for this action.",
      "LOCATION_CONTEXT_REQUIRED"
    );
  }

  return {
    permission,
    scope,
  };
}

export default {
  assertBusinessResourceAuthority,
  assertEffectivePermission,
  assertLocationResourceAuthority,
  canUsePermissionAtCurrentScope,
  hasBusinessResourceAuthority,
  hasEffectivePermission,
  hasLocationAuthority,
  hasLocationResourceAuthority,
  resolveEffectiveAuthority,
};
