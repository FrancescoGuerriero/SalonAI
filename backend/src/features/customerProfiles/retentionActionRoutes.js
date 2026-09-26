import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as controller from "./retentionActionController.js";

const router = express.Router();

router.get(
  "/dormant",
  asyncHandler(controller.dormant)
);

router.post(
  "/dormant/queue",
  requirePermissions("communications:manage"),
  asyncHandler(controller.queueDormant)
);

router.post(
  "/follow-ups/queue",
  requirePermissions("communications:manage"),
  asyncHandler(controller.queueFollowUps)
);

export default router;
