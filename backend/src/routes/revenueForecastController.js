import { Router } from "express";

import {
  cancelCampaign,
  createCampaign,
  getCampaign,
  getCampaignResults,
  listCampaigns,
  scheduleCampaign,
  sendCampaign,
  updateCampaign,
} from "./rebookingCampaignController.js";

const router = Router();

router.get("/", listCampaigns);
router.post("/", createCampaign);
router.get("/:campaignId", getCampaign);
router.patch("/:campaignId", updateCampaign);
router.post("/:campaignId/schedule", scheduleCampaign);
router.post("/:campaignId/send", sendCampaign);
router.post("/:campaignId/cancel", cancelCampaign);
router.get("/:campaignId/results", getCampaignResults);

export default router;
