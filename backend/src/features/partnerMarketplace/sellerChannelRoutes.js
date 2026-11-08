import { Router } from "express";
import mongoose from "mongoose";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import { protect } from "../../middleware/authMiddleware.js";
import { effectiveAuthorityMiddleware } from "../../middleware/effectiveAuthorityMiddleware.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import { trustedTenantContextMiddleware } from "../../platform/tenancy/trustedTenantMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import { createServiceError } from "../../shared/serviceError.js";
import { fetchSellerChannelSnapshot } from "./sellerChannelAdapter.js";

const router = Router();
router.use(protect, trustedTenantContextMiddleware, effectiveAuthorityMiddleware);

router.get("/capabilities", requirePermissions("feature-control:read"), (_request, response) => {
  response.json({
    readOnly: true, sellerChannelProviders: ["amazon_seller_central", "ebay"],
    supportedReadOperations: ["listings", "orders", "fulfillments"],
    fulfillmentOperations: "ebay_status_read_only",
    returns: "not_implemented",
    listingPublication: "not_implemented",
    stockWriteback: "not_implemented",
    sourceOfTruth: "existing_integration_platform",
    productionAccepted: false,
  });
});

router.get("/:connectionId/:kind", (request, response, next) => {
  const permission = request.params.kind === "listings" ? "inventory:read" : "order:read";
  return requirePermissions(permission)(request, response, next);
},
  asyncHandler(async (request, response) => {
    const businessId = request.effectiveAuthority?.businessId;
    if (!businessId || !mongoose.isValidObjectId(businessId)) {
      throw createServiceError("Trusted business authority is required.", 403, {
        code: "SELLER_CHANNEL_TENANT_AUTHORITY_REQUIRED",
      });
    }
    if (!mongoose.isValidObjectId(request.params.connectionId)) {
      throw createServiceError("Invalid seller connection identifier.", 400);
    }
    const connection = await IntegrationConnection.findOne({
      _id: request.params.connectionId, business: businessId,
      provider: { $in: ["amazon_seller_central", "ebay"] },
      status: "connected",
    });
    if (!connection) {
      throw createServiceError("Connected seller account not found for this business.", 404, {
        code: "SELLER_CHANNEL_CONNECTION_NOT_FOUND",
      });
    }
    const snapshot = await fetchSellerChannelSnapshot(connection, request.params.kind, {
      limit: request.query.limit,
    });
    response.status(200).json({ success: true, snapshot });
  }));
export default router;
