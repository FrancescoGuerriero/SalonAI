import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  adminOnly,
  protect,
  superAdminOnly,
} from "../middleware/authMiddleware.js";
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

// Super Admin and Administrator can inspect the restored administration
// workspace. Mutating global platform controls remains Super-Admin-only.
router.get(
  "/features",
  adminOnly,
  asyncHandler(listFeatureControls)
);
router.get(
  "/settings",
  adminOnly,
  asyncHandler(listSettings)
);
router.get(
  "/audit-logs",
  adminOnly,
  asyncHandler(listAuditLogs)
);
router.get(
  "/dead-letters",
  adminOnly,
  asyncHandler(listDeadLetters)
);

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
