import {
  resolveTrustedTenantContext,
} from "./trustedTenantContext.js";

function middlewareError(
  message,
  code = "TRUSTED_TENANT_CONTEXT_REQUIRED",
  statusCode = 401
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export function getServerTrustedTenantSelection(request) {
  const selection = request?.trustedTenantSelection;

  if (
    !selection ||
    typeof selection !== "object" ||
    Array.isArray(selection)
  ) {
    return Object.freeze({
      businessId: null,
      locationId: null,
    });
  }

  return Object.freeze({
    businessId:
      selection.businessId === undefined
        ? null
        : selection.businessId,
    locationId:
      selection.locationId === undefined
        ? null
        : selection.locationId,
  });
}

/*
 * Additive request-context adapter for Roadmap v3.
 *
 * The default selector intentionally reads only request.trustedTenantSelection,
 * which must be populated by a server-controlled session/host/context resolver.
 * Raw headers, query parameters and request bodies are ignored by default.
 *
 * Even when a custom selector is introduced later for a location switcher,
 * resolveTrustedTenantContext still verifies the selected Business/Location
 * against the authenticated user's persisted BusinessMembership.
 */
export function createTrustedTenantContextMiddleware({
  selectionResolver = getServerTrustedTenantSelection,
  contextResolver = resolveTrustedTenantContext,
} = {}) {
  if (typeof selectionResolver !== "function") {
    throw middlewareError(
      "Trusted tenant selection resolver must be a function.",
      "INVALID_TRUSTED_TENANT_MIDDLEWARE",
      500
    );
  }

  if (typeof contextResolver !== "function") {
    throw middlewareError(
      "Trusted tenant context resolver must be a function.",
      "INVALID_TRUSTED_TENANT_MIDDLEWARE",
      500
    );
  }

  return async function trustedTenantContextMiddleware(
    request,
    response,
    next
  ) {
    try {
      if (!request?.user) {
        throw middlewareError(
          "Authentication is required before tenant context can be resolved."
        );
      }

      const selection =
        (await selectionResolver(request)) || {};

      const tenantContext = await contextResolver({
        authenticatedUser: request.user,
        requestedBusinessId:
          selection.businessId ?? null,
        requestedLocationId:
          selection.locationId ?? null,
      });

      request.tenantContext = tenantContext;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const trustedTenantContextMiddleware =
  createTrustedTenantContextMiddleware();

export default trustedTenantContextMiddleware;
