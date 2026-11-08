import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  protect,
} from "../../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import * as controller from "./commerceController.js";
import { servicePublicTenantContextMiddleware } from "../../middleware/serviceTenantMiddleware.js";
import { trustedTenantContextMiddleware } from "../../platform/tenancy/trustedTenantMiddleware.js";
import { effectiveAuthorityMiddleware } from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  createOrderInvoice,
  readOrderInvoice,
} from "./invoiceController.js";
import { requireFeature } from "../../services/featureControlService.js";

const router = express.Router();

router.get("/config", requireFeature("online-shop"), controller.getCommerceConfig);
router.get("/products", requireFeature("online-shop"), servicePublicTenantContextMiddleware, asyncHandler(controller.listProducts));
router.get(
  "/inventory/products",
  protect,
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions(
    "product:read"
  ),
  asyncHandler(controller.listInventoryProducts)
);
router.get("/products/:identifier", requireFeature("online-shop"), servicePublicTenantContextMiddleware, asyncHandler(controller.getProduct));

router.post(
  "/products",
  protect,
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions(
    "product:create"
  ),
  asyncHandler(controller.createProduct)
);
router.patch(
  "/products/:id",
  protect,
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions(
    "product:update"
  ),
  asyncHandler(controller.updateProduct)
);

router.patch(
  "/products/:id/publication",
  protect,
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
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
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions(
    "product:inventory:update"
  ),
  asyncHandler(controller.adjustStock)
);
router.get(
  "/products/:id/stock-adjustments",
  protect,
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions(
    "inventory:read"
  ),
  asyncHandler(controller.listStockAdjustments)
);
router.get(
  "/inventory/summary",
  protect,
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
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
router.get("/orders/mine", requireFeature("online-shop"), protect, servicePublicTenantContextMiddleware, asyncHandler(controller.listMyOrders));
router.get("/orders/:id", requireFeature("online-shop"), protect, servicePublicTenantContextMiddleware, asyncHandler(controller.getOrder));
router.post("/orders/:id/cancel", requireFeature("online-shop"), protect, servicePublicTenantContextMiddleware, asyncHandler(controller.cancelOrder));
router.get(
  "/orders",
  protect,
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions("order:read"),
  asyncHandler(controller.listOrders)
);
router.patch(
  "/orders/:id/status",
  protect,
  requirePermissions("order:update"),
  asyncHandler(controller.updateOrderStatus)
);
router.post(
  "/orders/:id/refunds",
  protect,
  requirePermissions("order:refund"),
  asyncHandler(controller.refundOrderPayment)
);
router.get(
  "/orders/:id/invoice",
  protect,
  requirePermissions("order:read"),
  asyncHandler(readOrderInvoice)
);
router.post(
  "/orders/:id/invoice",
  protect,
  requirePermissions("order:update"),
  asyncHandler(createOrderInvoice)
);

export default router;
