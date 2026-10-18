import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { effectiveAuthorityMiddleware } from "../../../middleware/effectiveAuthorityMiddleware.js";
import { requireAnyPermission } from "../../../middleware/permissionMiddleware.js";
import { apiRateLimiter } from "../../../middleware/securityMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../../../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../../platform/tenancy/trustedTenantMiddleware.js";

import {
  getSupplierPerformance,
  listReorderRecommendations,
} from "../controllers/inventoryPurchasingController.js";

const router = express.Router();

const readInventory = requireAnyPermission("inventory:read", "inventory:manage");

router.use(
  apiRateLimiter,
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware
);

router.get(
  "/reorder-recommendations",
  readInventory,
  asyncHandler(listReorderRecommendations)
);

router.get(
  "/supplier-performance",
  readInventory,
  asyncHandler(getSupplierPerformance)
);

export default router;
