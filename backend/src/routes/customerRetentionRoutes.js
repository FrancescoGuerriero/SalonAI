import express from "express";

import customerRetentionController from "../controllers/customerRetentionController.js";

const router = express.Router();

// Complete retention analytics
router.get(
  "/",
  customerRetentionController.getAnalytics
);

// Retention KPI summary
router.get(
  "/summary",
  customerRetentionController.getSummary
);

// New customers compared with returning customers
router.get(
  "/new-vs-returning",
  customerRetentionController.getNewVsReturning
);

// Customers who have not visited recently
router.get(
  "/dormant",
  customerRetentionController.getDormantCustomers
);

// Highest-value customers
router.get(
  "/top-customers",
  customerRetentionController.getTopCustomers
);

export default router;