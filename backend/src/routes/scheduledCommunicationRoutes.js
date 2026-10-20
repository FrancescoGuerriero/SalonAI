import express from "express";

import {
  cancelScheduledCampaign,
  getScheduledCommunication,
  rescheduleCampaign,
  scheduleCampaign,
  unscheduleCampaign,
} from "../controllers/scheduledCommunicationController.js";
import {
  getScopedScheduledCommunicationOverview,
  listScopedDueScheduledCommunications,
  listScopedScheduledCommunications,
} from "../controllers/scheduledCommunicationTenantController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  communicationEffectiveScopeMiddleware,
  scopedScheduledCommunicationResource,
} from "../middleware/communicationTenantMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../middleware/effectiveAuthorityMiddleware.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../platform/tenancy/trustedTenantMiddleware.js";

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

router.use(
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  communicationEffectiveScopeMiddleware
);

/*
|--------------------------------------------------------------------------
| Scheduled communication collection routes
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  readCommunications,
  listScopedScheduledCommunications
);

router.get(
  "/overview",
  readCommunications,
  getScopedScheduledCommunicationOverview
);

router.get(
  "/due",
  readCommunications,
  listScopedDueScheduledCommunications
);

/*
|--------------------------------------------------------------------------
| Individual scheduled communication routes
|--------------------------------------------------------------------------
*/

router.get(
  "/:campaignId",
  readCommunications,
  scopedScheduledCommunicationResource,
  getScheduledCommunication
);

router.patch(
  "/:campaignId/schedule",
  manageCommunications,
  scopedScheduledCommunicationResource,
  scheduleCampaign
);

router.patch(
  "/:campaignId/reschedule",
  manageCommunications,
  scopedScheduledCommunicationResource,
  rescheduleCampaign
);

router.patch(
  "/:campaignId/unschedule",
  manageCommunications,
  scopedScheduledCommunicationResource,
  unscheduleCampaign
);

router.patch(
  "/:campaignId/cancel",
  manageCommunications,
  scopedScheduledCommunicationResource,
  cancelScheduledCampaign
);

export default router;
