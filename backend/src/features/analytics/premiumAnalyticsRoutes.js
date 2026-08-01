import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { managementOnly } from "../../../middleware/roleMiddleware.js";
import { getPremiumAnalytics } from "./premiumAnalyticsController.js";

const router = express.Router();
router.use(protect);
router.use(managementOnly);
router.get("/", asyncHandler(getPremiumAnalytics));
export default router;
