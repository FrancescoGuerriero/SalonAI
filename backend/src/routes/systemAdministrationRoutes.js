import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
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
router.use(superAdminOnly);

router.get("/features", asyncHandler(listFeatureControls));
router.patch("/features/:featureId", asyncHandler(updateFeatureControl));
router.delete("/features/:featureId", asyncHandler(resetFeatureControl));
router.get("/settings", asyncHandler(listSettings));
router.patch("/settings/:key", asyncHandler(updateSetting));
router.get("/audit-logs", asyncHandler(listAuditLogs));
router.get("/dead-letters", asyncHandler(listDeadLetters));

export default router;
