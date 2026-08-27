import express from "express";

import asyncHandler
  from "../../../middleware/asyncHandler.js";

import {
  protect,
} from "../../../middleware/authMiddleware.js";

import {
  managementOnly,
} from "../../../middleware/roleMiddleware.js";

import {
  createSmsRule,
  listSmsRules,
} from "./smsController.js";

import {
  receiveSmsStatusWebhook,
} from "./smsStatusWebhookController.js";

const router =
  express.Router();

/*
 * Public Twilio SMS delivery-status webhook.
 *
 * Twilio signs every request using X-Twilio-Signature.
 * The controller validates that signature before processing
 * any provider status.
 */
router.post(
  "/status",
  asyncHandler(
    receiveSmsStatusWebhook
  )
);

/*
 * Everything below this point requires an authenticated
 * SalonAI management user.
 */
router.use(
  protect
);

router.use(
  managementOnly
);

router
  .route(
    "/rules"
  )
  .get(
    asyncHandler(
      listSmsRules
    )
  )
  .post(
    asyncHandler(
      createSmsRule
    )
  );

export default router;
