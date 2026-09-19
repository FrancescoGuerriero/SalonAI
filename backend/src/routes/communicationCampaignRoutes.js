import express from "express";

import {
  cancelCampaign,
  createCampaign,
  duplicateCampaign,
  getCampaign,
  getCampaignSummary,
  getRecipient,
  launchCampaign,
  listCampaigns,
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

/*
|--------------------------------------------------------------------------
| Authentication and authorisation
|--------------------------------------------------------------------------
*/

router.use(protect);
router.use(managementOnly);

/*
|--------------------------------------------------------------------------
| Collection routes
|--------------------------------------------------------------------------
*/

/**
 * Preview an audience before saving a campaign.
 *
 * POST /api/communication-campaigns/preview
 */
router.post(
  "/preview",
  manageCommunications,
  previewNewCampaignAudience
);

/**
 * Retrieve campaign statistics and analytics.
 *
 * GET /api/communication-campaigns/summary
 */
router.get(
  "/summary",
  readCommunications,
  getCampaignSummary
);

/**
 * Create a communication campaign.
 *
 * POST /api/communication-campaigns
 */
router.post(
  "/",
  manageCommunications,
  createCampaign
);

/**
 * List communication campaigns.
 *
 * GET /api/communication-campaigns
 */
router.get(
  "/",
  readCommunications,
  listCampaigns
);

/*
|--------------------------------------------------------------------------
| Campaign audience and recipient routes
|--------------------------------------------------------------------------
*/

/**
 * Preview the audience of an existing campaign.
 *
 * POST
 * /api/communication-campaigns/:campaignId/audience/preview
 */
router.post(
  "/:campaignId/audience/preview",
  manageCommunications,
  previewExistingCampaignAudience
);

/**
 * Generate personalised campaign-recipient records.
 *
 * POST
 * /api/communication-campaigns/:campaignId/recipients/prepare
 */
router.post(
  "/:campaignId/recipients/prepare",
  manageCommunications,
  prepareRecipients
);

/**
 * List campaign recipients.
 *
 * GET
 * /api/communication-campaigns/:campaignId/recipients
 */
router.get(
  "/:campaignId/recipients",
  readCommunications,
  listRecipients
);

/**
 * Retrieve one campaign recipient.
 *
 * GET
 * /api/communication-campaigns/:campaignId/recipients/:recipientId
 */
router.get(
  "/:campaignId/recipients/:recipientId",
  readCommunications,
  getRecipient
);

/*
|--------------------------------------------------------------------------
| Campaign lifecycle routes
|--------------------------------------------------------------------------
*/

/**
 * Queue a campaign for immediate delivery.
 *
 * POST
 * /api/communication-campaigns/:campaignId/launch
 */
router.post(
  "/:campaignId/launch",
  manageCommunications,
  launchCampaign
);

/**
 * Schedule a campaign for future delivery.
 *
 * POST
 * /api/communication-campaigns/:campaignId/schedule
 */
router.post(
  "/:campaignId/schedule",
  manageCommunications,
  scheduleCampaign
);

/**
 * Pause a queued or processing campaign.
 *
 * POST
 * /api/communication-campaigns/:campaignId/pause
 */
router.post(
  "/:campaignId/pause",
  manageCommunications,
  pauseCampaign
);

/**
 * Resume a paused campaign.
 *
 * POST
 * /api/communication-campaigns/:campaignId/resume
 */
router.post(
  "/:campaignId/resume",
  manageCommunications,
  resumeCampaign
);

/**
 * Cancel a campaign.
 *
 * POST
 * /api/communication-campaigns/:campaignId/cancel
 */
router.post(
  "/:campaignId/cancel",
  manageCommunications,
  cancelCampaign
);

/**
 * Recalculate campaign delivery statistics.
 *
 * POST
 * /api/communication-campaigns/:campaignId/delivery-counts/refresh
 */
router.post(
  "/:campaignId/delivery-counts/refresh",
  manageCommunications,
  refreshDeliveryCounts
);

/*
|--------------------------------------------------------------------------
| Campaign record routes
|--------------------------------------------------------------------------
*/

/**
 * Duplicate a campaign as a new draft.
 *
 * POST
 * /api/communication-campaigns/:campaignId/duplicate
 */
router.post(
  "/:campaignId/duplicate",
  manageCommunications,
  duplicateCampaign
);

/**
 * Retrieve one campaign.
 *
 * GET /api/communication-campaigns/:campaignId
 */
router.get(
  "/:campaignId",
  readCommunications,
  getCampaign
);

/**
 * Update an editable campaign.
 *
 * PATCH /api/communication-campaigns/:campaignId
 */
router.patch(
  "/:campaignId",
  manageCommunications,
  updateCampaign
);

/**
 * Delete a draft, failed or cancelled campaign.
 *
 * DELETE /api/communication-campaigns/:campaignId
 */
router.delete(
  "/:campaignId",
  manageCommunications,
  removeCampaign
);

export default router;