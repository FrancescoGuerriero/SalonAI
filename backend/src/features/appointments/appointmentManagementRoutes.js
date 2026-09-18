import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";

import {
  bulkStatus,
  calendar,
  conflict,
  create,
  customers,
  getAppointment,
  queueReminders,
  reminder,
  reschedule,
  status,
  stylists,
  summary,
} from "./appointmentManagementController.js";
import {
  confirmDemoPayment,
  createCheckout,
} from "./appointmentPaymentController.js";
import {
  communicationHistory,
  sendReminderNow,
} from "./appointmentStaffCommunicationController.js";
import {
  appointmentLifecycleNotification,
} from "./appointmentLifecycleNotificationMiddleware.js";
import {
  hasUserPermission,
  requireAnyPermission,
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";

const router = express.Router();

function requireStatusPermission(
  request,
  response,
  next
) {
  const requestedStatus =
    String(
      request.body?.status || ""
    )
      .trim()
      .toLowerCase()
      .replaceAll("-", "_");

  const permission =
    requestedStatus === "cancelled"
      ? "appointment:cancel"
      : "appointment:update";

  if (
    hasUserPermission(
      request.user,
      permission
    )
  ) {
    return next();
  }

  return response
    .status(403)
    .json({
      success: false,
      code:
        "INSUFFICIENT_PERMISSIONS",
      message:
        "You do not have permission to perform this action.",
      missingPermissions: [
        permission,
      ],
      requestId:
        request.requestId,
    });
}


router.post(
  "/",
  requirePermissions(
    "appointment:create"
  ),
  appointmentLifecycleNotification(
    "created"
  ),
  asyncHandler(create)
);

/*
|--------------------------------------------------------------------------
| Calendar and reporting
|--------------------------------------------------------------------------
*/

router.get(
  "/stylists",
  requireAnyPermission(
    "appointment:create",
    "appointment:update"
  ),
  asyncHandler(stylists)
);

router.get(
  "/customers",
  requireAnyPermission(
    "appointment:create",
    "appointment:update"
  ),
  asyncHandler(customers)
);

router.get(
  "/calendar",
  requirePermissions(
    "appointment:read"
  ),
  asyncHandler(calendar)
);

router.get(
  "/summary",
  requirePermissions(
    "appointment:read"
  ),
  asyncHandler(summary)
);

/*
|--------------------------------------------------------------------------
| Conflict checking
|--------------------------------------------------------------------------
*/

router.post(
  "/conflict",
  requireAnyPermission(
    "appointment:create",
    "appointment:update"
  ),
  asyncHandler(conflict)
);

/*
|--------------------------------------------------------------------------
| Bulk appointment actions
|--------------------------------------------------------------------------
*/

router.patch(
  "/bulk/status",
  requireStatusPermission,
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
  requirePermissions(
    "appointment:read"
  ),
  asyncHandler(getAppointment)
);

router.patch(
  "/:id/reschedule",
  requirePermissions(
    "appointment:update"
  ),
  appointmentLifecycleNotification("rescheduled"),
  asyncHandler(reschedule)
);

router.patch(
  "/:id/status",
  requireStatusPermission,
  appointmentLifecycleNotification("status"),
  asyncHandler(status)
);

router.post(
  "/:id/reminder",
  asyncHandler(reminder)
);

router.post(
  "/:id/communications/reminder",
  asyncHandler(sendReminderNow)
);

router.get(
  "/:id/communications",
  asyncHandler(communicationHistory)
);

router.post(
  "/:id/payments/checkout",
  asyncHandler(createCheckout)
);

router.post(
  "/:id/payments/:paymentId/confirm-demo",
  asyncHandler(confirmDemoPayment)
);

export default router;
