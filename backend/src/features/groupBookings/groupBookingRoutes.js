import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  hasRequestPermission,
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  addParticipant,
  create,
  getOne,
  groupStatus,
  list,
  participantStatus,
  rescheduleParticipant,
} from "./groupBookingController.js";

const router = express.Router();

function requireStatusPermission(request, response, next) {
  const requestedStatus = String(request.body?.status || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_");

  const permission =
    requestedStatus === "cancelled"
      ? "appointment:cancel"
      : "appointment:update";

  if (hasRequestPermission(request, permission)) {
    return next();
  }

  return response.status(403).json({
    success: false,
    code: "INSUFFICIENT_PERMISSIONS",
    message: "You do not have permission to perform this action.",
    missingPermissions: [permission],
    requestId: request.requestId,
  });
}

router.get("/", requirePermissions("appointment:read"), asyncHandler(list));
router.post("/", requirePermissions("appointment:create"), asyncHandler(create));
router.get("/:id", requirePermissions("appointment:read"), asyncHandler(getOne));

router.post(
  "/:id/participants",
  requirePermissions("appointment:create"),
  asyncHandler(addParticipant)
);

router.patch(
  "/:id/participants/:participantId/reschedule",
  requirePermissions("appointment:update"),
  asyncHandler(rescheduleParticipant)
);

router.patch(
  "/:id/participants/:participantId/status",
  requireStatusPermission,
  asyncHandler(participantStatus)
);

router.patch(
  "/:id/status",
  requireStatusPermission,
  asyncHandler(groupStatus)
);

export default router;
