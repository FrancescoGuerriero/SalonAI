import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./bookingRecoveryController.js";

const router = express.Router();

router.post("/intents", asyncHandler(controller.saveIntent));
router.get("/:token", asyncHandler(controller.recoveryIntent));
router.post("/:token/resume", asyncHandler(controller.resumeIntent));
router.post(
  "/:token/attribute-appointment",
  asyncHandler(controller.attributeAppointment)
);

export default router;
