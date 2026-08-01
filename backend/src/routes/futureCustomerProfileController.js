import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import { stripeWebhook } from "./commerceController.js";

const router = express.Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  asyncHandler(stripeWebhook)
);

export default router;
