import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { managementOnly } from "../../../middleware/roleMiddleware.js";
import { createCampaign, listCampaigns, scheduleCampaign } from "./emailCampaignController.js";

const router = express.Router();
router.use(protect);
router.use(managementOnly);
router.route("/").get(asyncHandler(listCampaigns)).post(asyncHandler(createCampaign));
router.post("/:campaignId/schedule", asyncHandler(scheduleCampaign));
export default router;
