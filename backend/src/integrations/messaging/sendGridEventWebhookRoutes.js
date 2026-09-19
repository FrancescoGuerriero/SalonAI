import express from "express";

import {
  receiveSendGridEvents,
} from "./sendGridEventWebhookController.js";
import {
  requireSendGridEventWebhookSignature,
} from "./sendGridEventWebhookSecurity.js";

const router =
  express.Router();

router.post(
  "/events",
  express.raw({
    type:
      "application/json",
    limit:
      "1mb",
  }),
  requireSendGridEventWebhookSignature,
  receiveSendGridEvents
);

export default router;
