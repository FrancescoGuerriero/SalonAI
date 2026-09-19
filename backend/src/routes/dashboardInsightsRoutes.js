import express from "express";

import dashboardInsightsController from "../controllers/dashboardInsightsController.js";

import {
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);
router.use(
  requirePermissions(
    "dashboard:view"
  )
);

router.get(
  "/",
  dashboardInsightsController.getInsights
);

export default router;