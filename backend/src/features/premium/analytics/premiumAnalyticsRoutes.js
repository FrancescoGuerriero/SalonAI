import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { requirePermissions } from "../../../middleware/permissionMiddleware.js";
import { getPremiumAnalytics } from "./premiumAnalyticsController.js";

const router = express.Router();
router.use(protect);
router.use(requirePermissions("premium-analytics:read"));
router.get("/", asyncHandler(getPremiumAnalytics));
export default router;
