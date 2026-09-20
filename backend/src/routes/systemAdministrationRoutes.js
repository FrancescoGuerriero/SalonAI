import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  adminOnly,
  protect,
} from "../middleware/authMiddleware.js";
import { superAdminOnly } from "../middleware/roleMiddleware.js";
import {
  listAuditLogs,
  listDeadLetters,
  listFeatureControls,
  listSettings,
  resetFeatureControl,
  updateFeatureControl,
  updateSetting,
} from "../controllers/systemAdministrationController.js";

const router = express.Router();

router.use(protect);

// Super Admin and Administrator can inspect the restored administration pages.
router.get("/features", adminOnly, asyncHandler(listFeatureControls));
router.get("/settings", adminOnly, asyncHandler(listSettings));
router.get("/audit-logs", adminOnly, asyncHandler(listAuditLogs));
router.get("/dead-letters", adminOnly, asyncHandler(listDeadLetters));

// Platform-level mutations remain Super-Admin-only.
router.patch(
  "/features/:featureId",
  superAdminOnly,
  asyncHandler(updateFeatureControl)
);
router.delete(
  "/features/:featureId",
  superAdminOnly,
  asyncHandler(resetFeatureControl)
);
router.patch(
  "/settings/:key",
  superAdminOnly,
  asyncHandler(updateSetting)
);

export default router;
