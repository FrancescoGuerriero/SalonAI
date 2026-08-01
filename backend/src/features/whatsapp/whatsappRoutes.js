import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { managementOnly } from "../../../middleware/roleMiddleware.js";
import { confirmBooking, listConversations, webhook } from "./whatsappController.js";

const router = express.Router();
router.post("/webhook", asyncHandler(webhook));
router.use(protect);
router.use(managementOnly);
router.get("/conversations", asyncHandler(listConversations));
router.post("/conversations/:conversationId/confirm-booking", asyncHandler(confirmBooking));
export default router;
