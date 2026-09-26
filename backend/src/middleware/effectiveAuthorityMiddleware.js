import {
  assertEffectivePermission,
  resolveEffectiveAuthority,
} from "../services/effectiveAuthorityService.js";

function middlewareError(
  message,
  code,
  statusCode = 401
) {
  const error = new Error(
    message
  );
  error.code = code;
  error.statusCode =
    statusCode;
  return error;
}

export function createEffectiveAuthorityMiddleware({
  authorityResolver =
    resolveEffectiveAuthority,
} = {}) {
  if (
    typeof authorityResolver !==
    "function"
  ) {
    throw middlewareError(
      "Effective authority resolver must be a function.",
      "INVALID_EFFECTIVE_AUTHORITY_MIDDLEWARE",
      500
    );
  }

  return async function effectiveAuthorityMiddleware(
    request,
    response,
    next
  ) {
    try {
      if (!request?.user) {
        throw middlewareError(
          "Authentication is required before effective authority can be resolved."
        );
      }

      if (
        !request.tenantContext
      ) {
        throw middlewareError(
          "Trusted tenant context must be resolved before effective authority."
        );
      }

      request.effectiveAuthority =
        await authorityResolver({
          user:
            request.user,
          tenantContext:
            request.tenantContext,
        });

      return next();
    } catch (error) {
      return next(
        error
      );
    }
  };
}

export const effectiveAuthorityMiddleware =
  createEffectiveAuthorityMiddleware();

export function requireEffectivePermissions(
  ...requiredPermissions
) {
  return function effectivePermissionMiddleware(
    request,
    response,
    next
  ) {
    try {
      if (
        !request.effectiveAuthority
      ) {
        throw middlewareError(
          "Effective authority must be resolved before checking permissions."
        );
      }

      const grants =
        requiredPermissions.map(
          (permission) =>
            assertEffectivePermission(
              request.effectiveAuthority,
              permission
            )
        );

      request.effectivePermissionGrants =
        grants;

      return next();
    } catch (error) {
      return next(
        error
      );
    }
  };
}

export default effectiveAuthorityMiddleware;
