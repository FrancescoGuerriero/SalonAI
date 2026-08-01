import express from "express";

import {
  authorize,
} from "../../middleware/authMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./staffRotaController.js";

const router = express.Router();
const rotaManagers = authorize("admin", "manager");

router.get(
  "/week",
  asyncHandler(controller.week)
);

router.post(
  "/shifts",
  rotaManagers,
  asyncHandler(controller.createShift)
);

router.patch(
  "/shifts/:shiftId",
  rotaManagers,
  asyncHandler(controller.updateShift)
);

router.delete(
  "/shifts/:shiftId",
  rotaManagers,
  asyncHandler(controller.deleteShift)
);

router.post(
  "/weeks/publish",
  rotaManagers,
  asyncHandler(controller.publishWeek)
);

router.post(
  "/shifts/:shiftId/clock-in",
  rotaManagers,
  asyncHandler(controller.clockIn)
);

router.post(
  "/shifts/:shiftId/clock-out",
  rotaManagers,
  asyncHandler(controller.clockOut)
);

router.patch(
  "/shifts/:shiftId/attendance",
  rotaManagers,
  asyncHandler(controller.updateAttendance)
);

export default router;
