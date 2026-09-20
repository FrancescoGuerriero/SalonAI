import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  requireAnyPermission,
} from "../../../middleware/permissionMiddleware.js";

import {
  getSupplierPerformance,
  listReorderRecommendations,
} from "../controllers/inventoryPurchasingController.js";


const router = express.Router();

const readInventory =
  requireAnyPermission(
    "inventory:read",
    "inventory:manage"
  );

router.use(protect);

router.get(
  "/reorder-recommendations",
  readInventory,
  asyncHandler(
    listReorderRecommendations
  )
);

router.get(
  "/supplier-performance",
  readInventory,
  asyncHandler(
    getSupplierPerformance
  )
);

export default router;
