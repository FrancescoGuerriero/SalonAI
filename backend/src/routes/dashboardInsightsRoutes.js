import express from "express";

import dashboardInsightsController from "../controllers/dashboardInsightsController.js";

import {
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);

router.get(
  "/",
  dashboardInsightsController.getInsights
);

export default router;