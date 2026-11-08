import mongoose from "mongoose";
import Order from "./Order.js";
import { commerceTenantFilter } from "./commerceTenantOwnership.js";
import { createServiceError } from "../../shared/serviceError.js";

/**
 * Management mutations must be authorised against the actual Order before
 * invoking existing Stripe, invoice or fulfilment services.
 * A caller-supplied Business/Location or legacy unowned Order is never trusted.
 */
export async function requireScopedCommerceOrder(request, response, next) {
  try {
    const id = String(request.params?.id || "");
    if (!mongoose.isValidObjectId(id)) {
      throw createServiceError("Invalid order ID.", 400);
    }
    const owner = commerceTenantFilter(request.effectiveAuthority);
    const permitted = await Order.exists({ _id: id, ...owner });
    if (!permitted) {
      throw createServiceError("Order not found.", 404);
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
