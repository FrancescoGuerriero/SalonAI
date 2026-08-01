import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./reportController.js";

const router = express.Router();

router.get(
  "/summary",
  asyncHandler(controller.summary)
);

router.get(
  "/appointments.csv",
  asyncHandler(controller.appointmentsCsv)
);

router.get(
  "/communications.csv",
  asyncHandler(controller.communicationsCsv)
);

router.get(
  "/management.xlsx",
  asyncHandler(controller.workbook)
);

export default router;
