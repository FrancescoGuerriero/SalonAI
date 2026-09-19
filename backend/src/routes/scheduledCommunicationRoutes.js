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
import {
  requireAnyPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

const router = express.Router();

const readCommunications =
  requireAnyPermission(
    "communications:read",
    "communications:manage"
  );

const manageCommunications =
  requirePermissions(
    "communications:manage"
  );

router.use(protect);
router.use(managementOnly);

/*
|--------------------------------------------------------------------------
| Scheduled communication collection routes
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  readCommunications,
  listScheduledCommunications
);

router.get(
  "/overview",
  readCommunications,
  getScheduledCommunicationsOverview
);

router.get(
  "/due",
  readCommunications,
  listDueScheduledCommunications
);

/*
|--------------------------------------------------------------------------
| Individual scheduled communication routes
|--------------------------------------------------------------------------
*/

router.get(
  "/:campaignId",
  readCommunications,
  getScheduledCommunication
);

router.patch(
  "/:campaignId/schedule",
  manageCommunications,
  scheduleCampaign
);

router.patch(
  "/:campaignId/reschedule",
  manageCommunications,
  rescheduleCampaign
);

router.patch(
  "/:campaignId/unschedule",
  manageCommunications,
  unscheduleCampaign
);

router.patch(
  "/:campaignId/cancel",
  manageCommunications,
  cancelScheduledCampaign
);

export default router;