import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  adminOnly,
  managementOnly,
  protect,
} from "../../middleware/authMiddleware.js";
import * as controller from "./commerceController.js";
import { requireFeature } from "../../services/featureControlService.js";

const router = express.Router();

router.get("/config", requireFeature("online-shop"), controller.getCommerceConfig);
router.get("/products", requireFeature("online-shop"), asyncHandler(controller.listProducts));
router.get(
  "/inventory/products",
  protect,
  managementOnly,
  asyncHandler(controller.listInventoryProducts)
);
router.get("/products/:identifier", requireFeature("online-shop"), asyncHandler(controller.getProduct));

router.post(
  "/products",
  protect,
  adminOnly,
  asyncHandler(controller.createProduct)
);
router.patch(
  "/products/:id",
  protect,
  managementOnly,
  asyncHandler(controller.updateProduct)
);
router.post(
  "/products/:id/stock-adjustments",
  protect,
  managementOnly,
  asyncHandler(controller.adjustStock)
);
router.get(
  "/products/:id/stock-adjustments",
  protect,
  managementOnly,
  asyncHandler(controller.listStockAdjustments)
);
router.get(
  "/inventory/summary",
  protect,
  managementOnly,
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
  managementOnly,
  asyncHandler(controller.listOrders)
);
router.patch(
  "/orders/:id/status",
  protect,
  managementOnly,
  asyncHandler(controller.updateOrderStatus)
);
router.post(
  "/orders/:id/refunds",
  protect,
  managementOnly,
  asyncHandler(controller.refundOrderPayment)
);

export default router;
