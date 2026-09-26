import express from "express";

import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./staffRotaController.js";

const router = express.Router();
const manageRota = requirePermissions("employee:schedule:update");

router.get(
  "/week",
  asyncHandler(controller.week)
);

router.post(
  "/shifts",
  manageRota,
  asyncHandler(controller.createShift)
);

router.patch(
  "/shifts/:shiftId",
  manageRota,
  asyncHandler(controller.updateShift)
);

router.delete(
  "/shifts/:shiftId",
  manageRota,
  asyncHandler(controller.deleteShift)
);

router.post(
  "/weeks/publish",
  manageRota,
  asyncHandler(controller.publishWeek)
);

router.post(
  "/shifts/:shiftId/clock-in",
  manageRota,
  asyncHandler(controller.clockIn)
);

router.post(
  "/shifts/:shiftId/clock-out",
  manageRota,
  asyncHandler(controller.clockOut)
);

router.patch(
  "/shifts/:shiftId/attendance",
  manageRota,
  asyncHandler(controller.updateAttendance)
);

export default router;
