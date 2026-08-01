import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";

import {
  bulkStatus,
  calendar,
  conflict,
  getAppointment,
  queueReminders,
  reminder,
  reschedule,
  status,
  summary,
} from "./appointmentManagementController.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Calendar and reporting
|--------------------------------------------------------------------------
*/

router.get(
  "/calendar",
  asyncHandler(calendar)
);

router.get(
  "/summary",
  asyncHandler(summary)
);

/*
|--------------------------------------------------------------------------
| Conflict checking
|--------------------------------------------------------------------------
*/

router.post(
  "/conflict",
  asyncHandler(conflict)
);

/*
|--------------------------------------------------------------------------
| Bulk appointment actions
|--------------------------------------------------------------------------
*/

router.patch(
  "/bulk/status",
  asyncHandler(bulkStatus)
);

/*
|--------------------------------------------------------------------------
| Automatic reminder queue
|--------------------------------------------------------------------------
*/

router.post(
  "/queue-reminders",
  asyncHandler(queueReminders)
);

/*
|--------------------------------------------------------------------------
| Individual appointment actions
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  asyncHandler(getAppointment)
);

router.patch(
  "/:id/reschedule",
  asyncHandler(reschedule)
);

router.patch(
  "/:id/status",
  asyncHandler(status)
);

router.post(
  "/:id/reminder",
  asyncHandler(reminder)
);

export default router;