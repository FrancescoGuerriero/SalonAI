import express from "express";

import asyncHandler from "../../middleware/asyncHandler.js";
import { sendChatbotMessage } from "./chatbotController.js";
import chatbotRateLimit from "./chatbotRateLimit.js";

const router = express.Router();

router.post(
  "/message",
  chatbotRateLimit,
  asyncHandler(sendChatbotMessage)
);

export default router;
