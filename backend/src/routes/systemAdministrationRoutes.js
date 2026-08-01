import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import { managementOnly } from "../middleware/roleMiddleware.js";
import {
  listAuditLogs,
  listDeadLetters,
  listSettings,
  updateSetting,
} from "../controllers/systemAdministrationController.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);

router.get("/settings", asyncHandler(listSettings));
router.patch("/settings/:key", asyncHandler(updateSetting));
router.get("/audit-logs", asyncHandler(listAuditLogs));
router.get("/dead-letters", asyncHandler(listDeadLetters));

export default router;
