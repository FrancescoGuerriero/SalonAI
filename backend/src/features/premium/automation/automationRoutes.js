import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { managementOnly } from "../../../middleware/roleMiddleware.js";
import { createJourney, listJourneys, toggleJourney } from "./automationController.js";

const router = express.Router();
router.use(protect);
router.use(managementOnly);
router.route("/journeys").get(asyncHandler(listJourneys)).post(asyncHandler(createJourney));
router.patch("/journeys/:journeyId", asyncHandler(toggleJourney));
export default router;
