import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../../../middleware/permissionMiddleware.js";

import {
  createJourney,
  listJourneys,
  updateJourney,
} from "./automationController.js";

const router =
  express.Router();

router.use(protect);
router.use(
  requirePermissions(
    "retention-automation:manage"
  )
);

router
  .route("/journeys")
  .get(
    asyncHandler(
      listJourneys
    )
  )
  .post(
    asyncHandler(
      createJourney
    )
  );

router.patch(
  "/journeys/:journeyId",
  asyncHandler(
    updateJourney
  )
);

export default router;
