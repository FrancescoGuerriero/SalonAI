import {
  permissionsForRole,
} from "../constants/permissions.js";
import {
  canUsePermissionAtCurrentScope,
} from "../services/effectiveAuthorityService.js";

export function hasUserPermission(user, permission) {
  if (!user || !permission) {
    return false;
  }

  if (
    String(user.role || "").trim().toLowerCase() ===
    "super_admin"
  ) {
    return true;
  }

  return permissionsForRole(
    user.role,
    user.permissions,
    user.rolePermissions
  ).includes(permission);
}

export function hasRequestPermission(request, permission) {
  if (!request || !permission) {
    return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      request,
      "effectiveAuthority"
    )
  ) {
    return canUsePermissionAtCurrentScope(
      request.effectiveAuthority,
      permission
    );
  }

  return hasUserPermission(
    request.user,
    permission
  );
}

export function requirePermissions(...requiredPermissions) {
  return function permissionMiddleware(req, res, next) {
    const missing = requiredPermissions.filter(
      (permission) =>
        !hasRequestPermission(
          req,
          permission
        )
    );

    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        code: "INSUFFICIENT_PERMISSIONS",
        message: "You do not have permission to perform this action.",
        missingPermissions: missing,
        requestId: req.requestId,
      });
    }

    return next();
  };
}

export function requireAnyPermission(...acceptedPermissions) {
  return function anyPermissionMiddleware(req, res, next) {
    if (
      acceptedPermissions.some(
        (permission) =>
          hasRequestPermission(
            req,
            permission
          )
      )
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "You do not have permission to perform this action.",
      requiredAnyOf: acceptedPermissions,
      requestId: req.requestId,
    });
  };
}
