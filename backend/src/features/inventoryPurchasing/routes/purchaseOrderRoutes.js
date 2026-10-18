import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { effectiveAuthorityMiddleware } from "../../../middleware/effectiveAuthorityMiddleware.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../../../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../../../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../../platform/tenancy/trustedTenantMiddleware.js";

import {
  approvePurchaseOrderHandler,
  cancelPurchaseOrderHandler,
  createPurchaseOrderHandler,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrderHandler,
  submitPurchaseOrderHandler,
  updatePurchaseOrder,
} from "../controllers/purchaseOrderController.js";

const router = express.Router();

const readInventory = requireAnyPermission("inventory:read", "inventory:manage");
const manageInventory = requirePermissions("inventory:manage");

router.use(
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware
);

router
  .route("/")
  .get(readInventory, asyncHandler(listPurchaseOrders))
  .post(manageInventory, asyncHandler(createPurchaseOrderHandler));

router
  .route("/:purchaseOrderId")
  .get(readInventory, asyncHandler(getPurchaseOrder))
  .patch(manageInventory, asyncHandler(updatePurchaseOrder));

router.post(
  "/:purchaseOrderId/submit",
  manageInventory,
  asyncHandler(submitPurchaseOrderHandler)
);

router.post(
  "/:purchaseOrderId/approve",
  manageInventory,
  asyncHandler(approvePurchaseOrderHandler)
);

router.post(
  "/:purchaseOrderId/cancel",
  manageInventory,
  asyncHandler(cancelPurchaseOrderHandler)
);

router.post(
  "/:purchaseOrderId/receive",
  manageInventory,
  asyncHandler(receivePurchaseOrderHandler)
);

export default router;
