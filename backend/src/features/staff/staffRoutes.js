import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import * as controller from "./staffController.js";

const router = express.Router();

const readEmployees =
  requirePermissions(
    "employee:read"
  );

const updateEmployeeSchedule =
  requirePermissions(
    "employee:schedule:update"
  );

router.get(
  "/time-off",
  readEmployees,
  asyncHandler(
    controller.listTimeOff
  )
);

router.patch(
  "/time-off/:id",
  updateEmployeeSchedule,
  asyncHandler(
    controller.updateTimeOff
  )
);

router.get(
  "/:staffId/availability",
  readEmployees,
  asyncHandler(
    controller.week
  )
);

router.put(
  "/:staffId/availability",
  updateEmployeeSchedule,
  asyncHandler(
    controller.setAvailability
  )
);

router.get(
  "/:staffId/day",
  readEmployees,
  asyncHandler(
    controller.day
  )
);

router.post(
  "/:staffId/time-off",
  updateEmployeeSchedule,
  asyncHandler(
    controller.requestTimeOff
  )
);

export default router;
