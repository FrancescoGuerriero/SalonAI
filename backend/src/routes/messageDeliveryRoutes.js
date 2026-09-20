import express from "express";

import {
  cancelDelivery,
  getCampaignSummary,
  getConfiguration,
  getDelivery,
  getProviderStatus,
  listDeliveries,
  receiveTwilioStatusWebhook,
  retryDelivery,
  retryDueDeliveries,
  sendMessage,
  sendMessageBatch,
  verifyAllChannels,
  verifyChannel,
} from "../controllers/messageDeliveryController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requireAnyPermission,
  requirePermissions,
} from "../middleware/permissionMiddleware.js";

import twilioWebhookProtection from "../middleware/twilioWebhookMiddleware.js";

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
 * Twilio sends status callbacks as
 * application/x-www-form-urlencoded.
 *
 * The request body must be parsed before
 * signature verification because all
 * received form parameters are included
 * in Twilio's signature calculation.
 *
 * This public route is placed before the
 * SalonAI JWT middleware because Twilio
 * cannot provide an application token.
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
 * All remaining message-delivery routes
 * require an authenticated SalonAI
 * management account.
 */
router.use(protect);

/*
 * Configuration and provider checks.
 */
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

/*
 * Send and record messages.
 */
router.post(
  "/send",
  manageCommunications,
  sendMessage
);

router.post(
  "/send-batch",
  manageCommunications,
  sendMessageBatch
);

/*
 * Process retryable deliveries whose
 * scheduled retry time has arrived.
 *
 * This route must remain before the
 * dynamic delivery identifier route.
 */
router.post(
  "/deliveries/retries/process-due",
  manageCommunications,
  retryDueDeliveries
);

/*
 * Delivery reporting.
 */
router.get(
  "/deliveries",
  readCommunications,
  listDeliveries
);

router.get(
  "/campaigns/:campaignId/summary",
  readCommunications,
  getCampaignSummary
);

router.get(
  "/provider-status/:channel/:providerMessageId",
  readCommunications,
  getProviderStatus
);

/*
 * Individual delivery management.
 */
router.get(
  "/deliveries/:identifier",
  readCommunications,
  getDelivery
);

router.post(
  "/deliveries/:identifier/retry",
  manageCommunications,
  retryDelivery
);

router.patch(
  "/deliveries/:identifier/cancel",
  manageCommunications,
  cancelDelivery
);

export default router;