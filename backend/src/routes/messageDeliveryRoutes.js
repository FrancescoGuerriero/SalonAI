import express from "express";

import {
  cancelDelivery,
  getConfiguration,
  getDelivery,
  getProviderStatus,
  receiveTwilioStatusWebhook,
  retryDelivery,
  verifyAllChannels,
  verifyChannel,
} from "../controllers/messageDeliveryController.js";
import {
  getScopedCampaignDeliverySummary,
  listScopedDeliveries,
  retryScopedDueDeliveries,
  sendScopedMessage,
  sendScopedMessageBatch,
} from "../controllers/communicationTenantController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  communicationReferenceScopeMiddleware,
} from "../middleware/communicationReferenceScopeMiddleware.js";
import {
  communicationEffectiveScopeMiddleware,
  scopedCampaignResource,
  scopedDeliveryResource,
  scopedProviderDeliveryResource,
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
import twilioWebhookProtection from "../middleware/twilioWebhookMiddleware.js";
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
 * Provider callbacks stay outside SalonAI staff/JWT RBAC. Their provider
 * signature remains the authentication boundary; the callback updates the
 * already-owned canonical MessageDelivery record selected by provider ID.
 */
router.post(
  "/webhooks/twilio/status",
  express.urlencoded({
    extended: false,
    limit: "100kb",
  }),
  twilioWebhookProtection,
  receiveTwilioStatusWebhook
);

/*
 * Interactive management routes compose the existing communications
 * permission model with trusted Business/Location effective authority.
 */
router.use(
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  communicationEffectiveScopeMiddleware
);

router.get(
  "/configuration",
  readCommunications,
  getConfiguration
);

router.post(
  "/verify",
  manageCommunications,
  verifyAllChannels
);

router.post(
  "/verify/:channel",
  manageCommunications,
  verifyChannel
);

router.post(
  "/send",
  manageCommunications,
  communicationReferenceScopeMiddleware,
  sendScopedMessage
);

router.post(
  "/send-batch",
  manageCommunications,
  communicationReferenceScopeMiddleware,
  sendScopedMessageBatch
);

router.post(
  "/deliveries/retries/process-due",
  manageCommunications,
  retryScopedDueDeliveries
);

router.get(
  "/deliveries",
  readCommunications,
  listScopedDeliveries
);

router.get(
  "/campaigns/:campaignId/summary",
  readCommunications,
  scopedCampaignResource,
  getScopedCampaignDeliverySummary
);

router.get(
  "/provider-status/:channel/:providerMessageId",
  readCommunications,
  scopedProviderDeliveryResource,
  getProviderStatus
);

router.get(
  "/deliveries/:identifier",
  readCommunications,
  scopedDeliveryResource,
  getDelivery
);

router.post(
  "/deliveries/:identifier/retry",
  manageCommunications,
  scopedDeliveryResource,
  retryDelivery
);

router.patch(
  "/deliveries/:identifier/cancel",
  manageCommunications,
  scopedDeliveryResource,
  cancelDelivery
);

export default router;
