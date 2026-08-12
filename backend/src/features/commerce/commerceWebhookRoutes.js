import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  stripeCheckoutWebhook,
} from "./stripeWebhookController.js";

const router =
  express.Router();

router.post(
  "/stripe",
  express.raw({
    type: "application/json",
  }),
  asyncHandler(
    stripeCheckoutWebhook
  )
);

export default router;
