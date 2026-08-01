import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./retentionActionController.js";

const router = express.Router();

router.get(
  "/dormant",
  asyncHandler(controller.dormant)
);

router.post(
  "/dormant/queue",
  asyncHandler(controller.queueDormant)
);

router.post(
  "/follow-ups/queue",
  asyncHandler(controller.queueFollowUps)
);

export default router;
