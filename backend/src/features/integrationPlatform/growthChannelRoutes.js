import express from "express";

import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./growthChannelController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/reviews", read, asyncHandler(controller.reviews));
router.post(
  "/google-business-profile/:connectionId/sync-reviews",
  write,
  asyncHandler(controller.syncGoogleReviews)
);
router.put(
  "/reviews/:reviewId/response",
  write,
  asyncHandler(controller.saveReviewResponse)
);
router.post(
  "/reviews/:reviewId/response/approve",
  write,
  asyncHandler(controller.approveReviewResponse)
);
router.post(
  "/reviews/:reviewId/response/reject",
  write,
  asyncHandler(controller.rejectReviewResponse)
);
router.post(
  "/reviews/:reviewId/response/publish",
  write,
  asyncHandler(controller.publishReviewResponse)
);

export default router;
