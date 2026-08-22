import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  managementOnly,
} from "../../../middleware/roleMiddleware.js";

import {
  confirmBooking,
  getConversation,
  listConversations,
  markConversationRead,
  updateBookingSession,
  updateConversationStatus,
} from "./whatsappController.js";

import {
  receiveWebhook,
  verifyWebhookSubscription,
} from "./whatsappWebhookController.js";

import {
  createOutboundWhatsAppMessage,
  getWhatsAppOutboundPolicy,
  sendConversationMessageWithPolicy,
} from "./whatsappOutboundController.js";

const router = express.Router();

/*
 * Public WhatsApp provider webhook.
 *
 * GET  -> Meta Cloud API subscription verification.
 * POST -> inbound Meta or Twilio webhook events,
 *         selected through WHATSAPP_PROVIDER.
 */
router.get(
  "/webhook",
  asyncHandler(
    verifyWebhookSubscription
  )
);

router.post(
  "/webhook",
  asyncHandler(
    receiveWebhook
  )
);

/*
 * Everything below this point requires an
 * authenticated management account.
 */
router.use(protect);
router.use(managementOnly);

router.get(
  "/outbound-policy",
  asyncHandler(
    getWhatsAppOutboundPolicy
  )
);

router.post(
  "/messages",
  asyncHandler(
    createOutboundWhatsAppMessage
  )
);

router.get(
  "/conversations",
  asyncHandler(
    listConversations
  )
);

router.get(
  "/conversations/:conversationId",
  asyncHandler(
    getConversation
  )
);

router.patch(
  "/conversations/:conversationId/read",
  asyncHandler(
    markConversationRead
  )
);

router.patch(
  "/conversations/:conversationId/status",
  asyncHandler(
    updateConversationStatus
  )
);

router.patch(
  "/conversations/:conversationId/booking-session",
  asyncHandler(
    updateBookingSession
  )
);

router.post(
  "/conversations/:conversationId/messages",
  asyncHandler(
    sendConversationMessageWithPolicy
  )
);

router.post(
  "/conversations/:conversationId/confirm-booking",
  asyncHandler(
    confirmBooking
  )
);

export default router;
