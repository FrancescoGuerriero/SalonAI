import { createServiceError } from "../../shared/serviceError.js";

/**
 * Seller provider accounts have no trusted per-location ownership field.
 * Refuse tenant-wide seller reads and staging under selected-location authority.
 */
export function requireSellerTenantWideLocation(request, _response, next) {
  if (request.effectiveAuthority?.locationAccessMode !== "all") {
    return next(createServiceError("Seller provider accounts require tenant-wide location access.", 403, {
      code: "SELLER_CHANNEL_TENANT_WIDE_LOCATION_REQUIRED",
    }));
  }
  return next();
}
