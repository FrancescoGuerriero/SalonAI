import { Router } from "express";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";

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
router.post("/", requirePermissions("communications:manage"), createCampaign);
router.get("/:campaignId", getCampaign);
router.patch("/:campaignId", requirePermissions("communications:manage"), updateCampaign);
router.post("/:campaignId/schedule", requirePermissions("communications:manage"), scheduleCampaign);
router.post("/:campaignId/send", requirePermissions("communications:manage"), sendCampaign);
router.post("/:campaignId/cancel", requirePermissions("communications:manage"), cancelCampaign);
router.get("/:campaignId/results", getCampaignResults);

export default router;
