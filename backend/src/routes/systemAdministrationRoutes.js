import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
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
router.get(
  "/features",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    listFeatureControls
  )
);
router.patch(
  "/features/:featureId",
  requirePermissions(
    "feature-control:update"
  ),
  asyncHandler(
    updateFeatureControl
  )
);
router.delete(
  "/features/:featureId",
  requirePermissions(
    "feature-control:update"
  ),
  asyncHandler(
    resetFeatureControl
  )
);
router.get(
  "/settings",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    listSettings
  )
);
router.patch(
  "/settings/:key",
  requirePermissions(
    "feature-control:update"
  ),
  asyncHandler(
    updateSetting
  )
);
router.get(
  "/audit-logs",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    listAuditLogs
  )
);
router.get(
  "/dead-letters",
  requirePermissions(
    "feature-control:read"
  ),
  asyncHandler(
    listDeadLetters
  )
);

export default router;
