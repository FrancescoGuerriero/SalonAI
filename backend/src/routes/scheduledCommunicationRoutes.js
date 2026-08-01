import express from "express";

import {
  cancelScheduledCampaign,
  getScheduledCommunication,
  getScheduledCommunicationsOverview,
  listDueScheduledCommunications,
  listScheduledCommunications,
  rescheduleCampaign,
  scheduleCampaign,
  unscheduleCampaign,
} from "../controllers/scheduledCommunicationController.js";

import {
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(managementOnly);

/*
|--------------------------------------------------------------------------
| Scheduled communication collection routes
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  listScheduledCommunications
);

router.get(
  "/overview",
  getScheduledCommunicationsOverview
);

router.get(
  "/due",
  listDueScheduledCommunications
);

/*
|--------------------------------------------------------------------------
| Individual scheduled communication routes
|--------------------------------------------------------------------------
*/

router.get(
  "/:campaignId",
  getScheduledCommunication
);

router.patch(
  "/:campaignId/schedule",
  scheduleCampaign
);

router.patch(
  "/:campaignId/reschedule",
  rescheduleCampaign
);

router.patch(
  "/:campaignId/unschedule",
  unscheduleCampaign
);

router.patch(
  "/:campaignId/cancel",
  cancelScheduledCampaign
);

export default router;