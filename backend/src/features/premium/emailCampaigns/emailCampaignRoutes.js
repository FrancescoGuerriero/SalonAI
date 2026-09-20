import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { requirePermissions } from "../../../middleware/permissionMiddleware.js";
import { createCampaign, listCampaigns, scheduleCampaign } from "./emailCampaignController.js";

const router = express.Router();
router.use(protect);
router.use(requirePermissions("email-campaign:manage"));
router.route("/").get(asyncHandler(listCampaigns)).post(asyncHandler(createCampaign));
router.post("/:campaignId/schedule", asyncHandler(scheduleCampaign));
export default router;
