import mongoose from "mongoose";
import { createServiceError } from "../../shared/serviceError.js";

/**
 * A checkout's business belongs to the authenticated, server-resolved
 * tenant context, NEVER the checkout body or arbitrary User profile fields.
 *
 * Existing customer checkout without a trusted tenant context stays legacy
 * unowned (and remains ineligible for seller-link approval).
 */
export function resolveCheckoutOrderBusiness(user, tenantContext = null) {
  if (tenantContext == null) return undefined;
  const userId = user?._id || user?.id;
  const businessId = tenantContext?.businessId;
  if (!mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(businessId) ||
      String(tenantContext.userId || "") !== String(userId)) {
    throw createServiceError("Trusted checkout tenant authority is inconsistent.", 403, {
      code: "COMMERCE_CHECKOUT_TENANT_AUTHORITY_INVALID",
    });
  }
  return businessId;
}
