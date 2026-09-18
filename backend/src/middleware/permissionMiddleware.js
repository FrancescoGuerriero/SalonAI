export function requirePermissions(...requiredPermissions) {
  return function permissionMiddleware(req, res, next) {
    const permissions = new Set(
      req.user?.permissions || []
    );

    if (req.user?.isSuperAdmin === true) {
      return next();
    }

    const missing = requiredPermissions.filter(
      (permission) => !permissions.has(permission)
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

    next();
  };
}
