import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  managementOnly,
} from "../../../middleware/roleMiddleware.js";

import {
  createJourney,
  listJourneys,
  previewJourney,
  updateJourney,
} from "./automationController.js";

const router =
  express.Router();

router.use(protect);
router.use(managementOnly);

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

router.get(
  "/journeys/:journeyId/preview",
  asyncHandler(
    previewJourney
  )
);

router.patch(
  "/journeys/:journeyId",
  asyncHandler(
    updateJourney
  )
);

export default router;
