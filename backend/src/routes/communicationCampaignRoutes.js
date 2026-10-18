import express from "express";

import {
  cancelCampaign,
  duplicateCampaign,
  getCampaign,
  getRecipient,
  launchCampaign,
  listRecipients,
  pauseCampaign,
  prepareRecipients,
  previewExistingCampaignAudience,
  previewNewCampaignAudience,
  refreshDeliveryCounts,
  removeCampaign,
  resumeCampaign,
  scheduleCampaign,
  updateCampaign,
} from "../controllers/communicationCampaignController.js";
import {
  createScopedCampaign,
  getScopedCampaignSummary,
  listScopedCampaigns,
} from "../controllers/communicationTenantController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  communicationEffectiveScopeMiddleware,
  scopedCampaignMutationResource,
  scopedCampaignResource,
  scopedRecipientResource,
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

/*
|--------------------------------------------------------------------------
| Trusted tenant/effective-authority chain
|--------------------------------------------------------------------------
|
| The existing communications permission catalogue remains authoritative.
| This chain only binds those permissions to the trusted Business/Location
| scope supplied by the AIIBP tenancy contract.
*/
router.use(
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  communicationEffectiveScopeMiddleware
);

/*
|--------------------------------------------------------------------------
| Collection routes
|--------------------------------------------------------------------------
*/

router.post(
  "/preview",
  manageCommunications,
  previewNewCampaignAudience
);

router.get(
  "/summary",
  readCommunications,
  getScopedCampaignSummary
);

router.post(
  "/",
  manageCommunications,
  createScopedCampaign
);

router.get(
  "/",
  readCommunications,
  listScopedCampaigns
);

/*
|--------------------------------------------------------------------------
| Campaign audience and recipient routes
|--------------------------------------------------------------------------
*/

router.post(
  "/:campaignId/audience/preview",
  scopedCampaignMutationResource,
  manageCommunications,
  previewExistingCampaignAudience
);

router.post(
  "/:campaignId/recipients/prepare",
  scopedCampaignMutationResource,
  manageCommunications,
  prepareRecipients
);

router.get(
  "/:campaignId/recipients",
  scopedCampaignResource,
  readCommunications,
  listRecipients
);

router.get(
  "/:campaignId/recipients/:recipientId",
  scopedCampaignResource,
  scopedRecipientResource,
  readCommunications,
  getRecipient
);

/*
|--------------------------------------------------------------------------
| Campaign lifecycle routes
|--------------------------------------------------------------------------
*/

router.post(
  "/:campaignId/launch",
  scopedCampaignMutationResource,
  manageCommunications,
  launchCampaign
);

router.post(
  "/:campaignId/schedule",
  scopedCampaignMutationResource,
  manageCommunications,
  scheduleCampaign
);

router.post(
  "/:campaignId/pause",
  scopedCampaignMutationResource,
  manageCommunications,
  pauseCampaign
);

router.post(
  "/:campaignId/resume",
  scopedCampaignMutationResource,
  manageCommunications,
  resumeCampaign
);

router.post(
  "/:campaignId/cancel",
  scopedCampaignMutationResource,
  manageCommunications,
  cancelCampaign
);

router.post(
  "/:campaignId/delivery-counts/refresh",
  scopedCampaignMutationResource,
  manageCommunications,
  refreshDeliveryCounts
);

/*
|--------------------------------------------------------------------------
| Campaign record routes
|--------------------------------------------------------------------------
*/

router.post(
  "/:campaignId/duplicate",
  scopedCampaignMutationResource,
  manageCommunications,
  duplicateCampaign
);

router.get(
  "/:campaignId",
  scopedCampaignResource,
  readCommunications,
  getCampaign
);

router.patch(
  "/:campaignId",
  scopedCampaignMutationResource,
  manageCommunications,
  updateCampaign
);

router.delete(
  "/:campaignId",
  scopedCampaignMutationResource,
  manageCommunications,
  removeCampaign
);

export default router;
