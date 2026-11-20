import {
  getServerTrustedTenantSelection,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import {
  resolveTrustedTenantContext,
} from "../../platform/tenancy/trustedTenantContext.js";

/**
 * Legacy checkout remains available when no trusted business selection has
 * been made by the server. A server-selected business must pass the canonical
 * membership resolver, or checkout fails before creating any order/payment.
 *
 * Never inspect request headers/body/query for tenant authority.
 */
export function createOptionalCheckoutTenantMiddleware({
  contextResolver = resolveTrustedTenantContext,
} = {}) {
  return async function optionalCheckoutTenantMiddleware(request, _response, next) {
    if (request?.trustedTenantSelection == null) return next();
    try {
      const selection = getServerTrustedTenantSelection(request);
      const context = await contextResolver({
        authenticatedUser: request.user,
        requestedBusinessId: selection.businessId,
        requestedLocationId: selection.locationId,
      });
      request.tenantContext = context;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const optionalCheckoutTenantMiddleware =
  createOptionalCheckoutTenantMiddleware();
