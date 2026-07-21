import express from "express";

import dashboardInsightsController from "../controllers/dashboardInsightsController.js";

const router = express.Router();

router.get(
  "/",
  dashboardInsightsController.getInsights
);

export default router;