import express from "express";

import {
  deliverCampaign,
  listDueCampaigns,
  previewAudience,
  processDueCampaignDeliveries,
} from "../controllers/campaignDeliveryController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

/*
 * Campaign delivery controls are limited
 * to authenticated salon-management users.
 */
router.use(protect);
router.use(
  requirePermissions(
    "communications:manage"
  )
);

/*
 * Scheduled campaign processing.
 *
 * These static routes must remain before
 * the dynamic campaign ID routes.
 */
router.get(
  "/due",
  listDueCampaigns
);

router.post(
  "/due/process",
  processDueCampaignDeliveries
);

/*
 * Preview the resolved customer audience
 * without sending any messages.
 */
router.get(
  "/:campaignId/audience-preview",
  previewAudience
);

/*
 * Process a campaign immediately.
 *
 * The campaign service controls whether
 * draft, scheduled or completed campaigns
 * are eligible for delivery.
 */
router.post(
  "/:campaignId/deliver",
  deliverCampaign
);

export default router;