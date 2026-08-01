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
  managementOnly,
  protect,
} from "../middleware/authMiddleware.js";

import twilioWebhookProtection from "../middleware/twilioWebhookMiddleware.js";

const router = express.Router();

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
router.use(managementOnly);

/*
 * Configuration and provider checks.
 */
router.get(
  "/configuration",
  getConfiguration
);

router.post(
  "/verify",
  verifyAllChannels
);

router.post(
  "/verify/:channel",
  verifyChannel
);

/*
 * Send and record messages.
 */
router.post(
  "/send",
  sendMessage
);

router.post(
  "/send-batch",
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
  retryDueDeliveries
);

/*
 * Delivery reporting.
 */
router.get(
  "/deliveries",
  listDeliveries
);

router.get(
  "/campaigns/:campaignId/summary",
  getCampaignSummary
);

router.get(
  "/provider-status/:channel/:providerMessageId",
  getProviderStatus
);

/*
 * Individual delivery management.
 */
router.get(
  "/deliveries/:identifier",
  getDelivery
);

router.post(
  "/deliveries/:identifier/retry",
  retryDelivery
);

router.patch(
  "/deliveries/:identifier/cancel",
  cancelDelivery
);

export default router;