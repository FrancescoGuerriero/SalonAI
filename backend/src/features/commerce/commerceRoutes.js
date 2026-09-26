import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  protect,
} from "../../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import * as controller from "./commerceController.js";
import { requireFeature } from "../../services/featureControlService.js";

const router = express.Router();

router.get("/config", requireFeature("online-shop"), controller.getCommerceConfig);
router.get("/products", requireFeature("online-shop"), asyncHandler(controller.listProducts));
router.get(
  "/inventory/products",
  protect,
  requirePermissions(
    "product:read"
  ),
  asyncHandler(controller.listInventoryProducts)
);
router.get("/products/:identifier", requireFeature("online-shop"), asyncHandler(controller.getProduct));

router.post(
  "/products",
  protect,
  requirePermissions(
    "product:create"
  ),
  asyncHandler(controller.createProduct)
);
router.patch(
  "/products/:id",
  protect,
  requirePermissions(
    "product:update"
  ),
  asyncHandler(controller.updateProduct)
);

router.patch(
  "/products/:id/publication",
  protect,
  requirePermissions(
    "product:publish"
  ),
  asyncHandler(
    controller.updateProductPublication
  )
);
router.post(
  "/products/:id/stock-adjustments",
  protect,
  requirePermissions(
    "product:inventory:update"
  ),
  asyncHandler(controller.adjustStock)
);
router.get(
  "/products/:id/stock-adjustments",
  protect,
  requirePermissions(
    "inventory:read"
  ),
  asyncHandler(controller.listStockAdjustments)
);
router.get(
  "/inventory/summary",
  protect,
  requirePermissions(
    "inventory:read"
  ),
  asyncHandler(controller.inventorySummary)
);

router.post("/checkout", requireFeature("online-shop"), protect, asyncHandler(controller.createCheckout));
router.post(
  "/checkout/:id/confirm-demo",
  requireFeature("online-shop"),
  protect,
  asyncHandler(controller.confirmDemoCheckout)
);
router.get("/orders/mine", requireFeature("online-shop"), protect, asyncHandler(controller.listMyOrders));
router.get("/orders/:id", requireFeature("online-shop"), protect, asyncHandler(controller.getOrder));
router.post("/orders/:id/cancel", requireFeature("online-shop"), protect, asyncHandler(controller.cancelOrder));
router.get(
  "/orders",
  protect,
  requirePermissions(
    "order:read"
  ),
  asyncHandler(controller.listOrders)
);
router.patch(
  "/orders/:id/status",
  protect,
  requirePermissions(
    "order:manage"
  ),
  asyncHandler(controller.updateOrderStatus)
);
router.post(
  "/orders/:id/refunds",
  protect,
  requirePermissions(
    "order:refund"
  ),
  asyncHandler(controller.refundOrderPayment)
);

export default router;
