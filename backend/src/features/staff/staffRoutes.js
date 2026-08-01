import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./staffController.js";

const router = express.Router();

router.get(
  "/time-off",
  asyncHandler(controller.listTimeOff)
);

router.patch(
  "/time-off/:id",
  asyncHandler(controller.updateTimeOff)
);

router.get(
  "/:staffId/availability",
  asyncHandler(controller.week)
);

router.put(
  "/:staffId/availability",
  asyncHandler(controller.setAvailability)
);

router.get(
  "/:staffId/day",
  asyncHandler(controller.day)
);

router.post(
  "/:staffId/time-off",
  asyncHandler(controller.requestTimeOff)
);

export default router;
