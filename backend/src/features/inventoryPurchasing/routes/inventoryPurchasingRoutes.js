import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  managementOnly,
} from "../../../middleware/roleMiddleware.js";

import {
  getSupplierPerformance,
  listReorderRecommendations,
} from "../controllers/inventoryPurchasingController.js";


const router = express.Router();

router.use(protect);
router.use(managementOnly);

router.get(
  "/reorder-recommendations",
  asyncHandler(
    listReorderRecommendations
  )
);

router.get(
  "/supplier-performance",
  asyncHandler(
    getSupplierPerformance
  )
);

export default router;
