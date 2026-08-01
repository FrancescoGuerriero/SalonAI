import express from "express";

import dashboardController from "../controllers/dashboardController.js";
import dashboardOperationsController from "../controllers/dashboardOperationsController.js";

import {
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);
router.get(
  "/operations",
  dashboardOperationsController.getSnapshot
);
router.get("/stats", dashboardController.getStats);
router.get("/revenue", dashboardController.getRevenue);
router.get(
  "/today",
  dashboardController.getTodayAppointments
);
router.get(
  "/activity",
  dashboardController.getRecentActivity
);
router.get("/alerts", dashboardController.getAlerts);
router.get(
  "/revenue-by-service",
  dashboardController.getRevenueByService
);
router.get(
  "/appointments-by-status",
  dashboardController.getAppointmentsByStatus
);
router.get(
  "/top-stylists",
  dashboardController.getTopStylists
);

export default router;
