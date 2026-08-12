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
  webhook,
} from "./whatsappController.js";
import {
  createOutboundWhatsAppMessage,
  getWhatsAppOutboundPolicy,
  sendConversationMessageWithPolicy,
} from "./whatsappOutboundController.js";

const router =
  express.Router();

router.post(
  "/webhook",
  asyncHandler(webhook)
);

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
