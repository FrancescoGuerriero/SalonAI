import { Router } from "express";
import mongoose from "mongoose";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import { protect } from "../../middleware/authMiddleware.js";
import { effectiveAuthorityMiddleware } from "../../middleware/effectiveAuthorityMiddleware.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import { trustedTenantContextMiddleware } from "../../platform/tenancy/trustedTenantMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import { createServiceError } from "../../shared/serviceError.js";
import { fetchEbayShippingFulfillments, fetchSellerChannelSnapshot } from "./sellerChannelAdapter.js";
import { stageSellerChannelSnapshot } from "./sellerChannelSyncService.js";
import { previewSellerChannelInventory } from "./sellerChannelReconciliationPreview.js";

const router = Router();
router.use(protect, trustedTenantContextMiddleware, effectiveAuthorityMiddleware);

async function ownedConnection(request) {
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
  return connection;
}

router.get("/capabilities", requirePermissions("feature-control:read"), (_request, response) => {
  response.json({
    readOnly: true, sellerChannelProviders: ["amazon_seller_central", "ebay"],
    supportedReadOperations: ["listings", "orders", "fulfillments", "shipping_fulfillments"],
    fulfillmentOperations: "ebay_read_only",
    returns: "not_implemented",
    listingPublication: "not_implemented",
    stockWriteback: "not_implemented",
    manualStaging: "listings_and_orders_only",
    sourceOfTruth: "existing_integration_platform",
    productionAccepted: false,
  });
});

// Dry-run reconciliation uses exclusively the server-verified location authority.
router.get("/:connectionId/reconciliation", requirePermissions("inventory:read"),
  requirePermissions("product:read"), asyncHandler(async (request, response) => {
    const result = await previewSellerChannelInventory(await ownedConnection(request), {
      businessId: request.effectiveAuthority.businessId,
      locationId: request.effectiveAuthority.locationId || null,
      limit: request.query.limit,
    });
    response.status(200).json({ success: true, result });
  }));

// Explicit operator action stages source records only, never canonical commerce data.
router.post("/:connectionId/stage/:kind", requirePermissions("feature-control:update"),
  (request, response, next) => {
    const permission = request.params.kind === "listings" ? "inventory:read" : "order:read";
    return requirePermissions(permission)(request, response, next);
  }, asyncHandler(async (request, response) => {
    const connection = await ownedConnection(request);
    const result = await stageSellerChannelSnapshot(connection, request.params.kind, {
      businessId: request.effectiveAuthority.businessId,
      actorId: request.user?._id || request.user?.id,
      requestId: request.requestId || "",
    });
    response.status(200).json({ success: true, result });
  }));

router.get("/:connectionId/fulfillments/:orderId", requirePermissions("order:read"),
  asyncHandler(async (request, response) => {
    const snapshot = await fetchEbayShippingFulfillments(await ownedConnection(request), request.params.orderId);
    response.status(200).json({ success: true, snapshot });
  }));

router.get("/:connectionId/:kind", (request, response, next) => {
  const permission = request.params.kind === "listings" ? "inventory:read" : "order:read";
  return requirePermissions(permission)(request, response, next);
}, asyncHandler(async (request, response) => {
  const snapshot = await fetchSellerChannelSnapshot(await ownedConnection(request), request.params.kind, {
    limit: request.query.limit,
  });
  response.status(200).json({ success: true, snapshot });
}));
export default router;
