import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import * as controller from "./reportController.js";

const router = express.Router();

router.get(
  "/summary",
  asyncHandler(controller.summary)
);

router.get(
  "/appointments.csv",
  requirePermissions("data-export:manage"),
  asyncHandler(controller.appointmentsCsv)
);

router.get(
  "/communications.csv",
  requirePermissions("data-export:manage"),
  asyncHandler(controller.communicationsCsv)
);

router.get(
  "/management.xlsx",
  requirePermissions("data-export:manage"),
  asyncHandler(controller.workbook)
);

export default router;
