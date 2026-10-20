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
  communicationReferenceScopeMiddleware,
} from "../middleware/communicationReferenceScopeMiddleware.js";
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
  communicationReferenceScopeMiddleware,
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
  communicationReferenceScopeMiddleware,
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
  manageCommunications,
  scopedCampaignMutationResource,
  previewExistingCampaignAudience
);

router.post(
  "/:campaignId/recipients/prepare",
  manageCommunications,
  scopedCampaignMutationResource,
  prepareRecipients
);

router.get(
  "/:campaignId/recipients",
  readCommunications,
  scopedCampaignResource,
  listRecipients
);

router.get(
  "/:campaignId/recipients/:recipientId",
  readCommunications,
  scopedCampaignResource,
  scopedRecipientResource,
  getRecipient
);

/*
|--------------------------------------------------------------------------
| Campaign lifecycle routes
|--------------------------------------------------------------------------
*/

router.post(
  "/:campaignId/launch",
  manageCommunications,
  scopedCampaignMutationResource,
  launchCampaign
);

router.post(
  "/:campaignId/schedule",
  manageCommunications,
  scopedCampaignMutationResource,
  scheduleCampaign
);

router.post(
  "/:campaignId/pause",
  manageCommunications,
  scopedCampaignMutationResource,
  pauseCampaign
);

router.post(
  "/:campaignId/resume",
  manageCommunications,
  scopedCampaignMutationResource,
  resumeCampaign
);

router.post(
  "/:campaignId/cancel",
  manageCommunications,
  scopedCampaignMutationResource,
  cancelCampaign
);

router.post(
  "/:campaignId/delivery-counts/refresh",
  manageCommunications,
  scopedCampaignMutationResource,
  refreshDeliveryCounts
);

/*
|--------------------------------------------------------------------------
| Campaign record routes
|--------------------------------------------------------------------------
*/

router.post(
  "/:campaignId/duplicate",
  manageCommunications,
  scopedCampaignMutationResource,
  duplicateCampaign
);

router.get(
  "/:campaignId",
  readCommunications,
  scopedCampaignResource,
  getCampaign
);

router.patch(
  "/:campaignId",
  manageCommunications,
  scopedCampaignMutationResource,
  communicationReferenceScopeMiddleware,
  updateCampaign
);

router.delete(
  "/:campaignId",
  manageCommunications,
  scopedCampaignMutationResource,
  removeCampaign
);

export default router;
