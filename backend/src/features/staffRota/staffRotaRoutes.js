import express from "express";

import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import {
  requireScopedRotaShiftMutation,
} from "./staffRotaAuthorityMiddleware.js";
import * as controller from "./staffRotaController.js";

const router = express.Router();
const manageRota = requirePermissions("employee:schedule:update");

const rotaTenantAuthority = [
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
];

const scopedExistingShiftMutation = [
  ...rotaTenantAuthority,
  manageRota,
  asyncHandler(
    requireScopedRotaShiftMutation
  ),
];

router.get(
  "/week",
  asyncHandler(controller.week)
);

/*
 * Shift creation is intentionally not wired to the existing-record authority
 * guard. createStaffShift() must first gain atomic trusted Business/locationRef
 * stamping for StaffShift + StaffAttendance.
 */
router.post(
  "/shifts",
  manageRota,
  asyncHandler(controller.createShift)
);

router.patch(
  "/shifts/:shiftId",
  ...scopedExistingShiftMutation,
  asyncHandler(controller.updateShift)
);

router.delete(
  "/shifts/:shiftId",
  ...scopedExistingShiftMutation,
  asyncHandler(controller.deleteShift)
);

/*
 * Publish-week remains on the legacy service until its bulk update can be
 * bounded to trusted Business/locationRef ownership.
 */
router.post(
  "/weeks/publish",
  manageRota,
  asyncHandler(controller.publishWeek)
);

router.post(
  "/shifts/:shiftId/clock-in",
  ...scopedExistingShiftMutation,
  asyncHandler(controller.clockIn)
);

router.post(
  "/shifts/:shiftId/clock-out",
  ...scopedExistingShiftMutation,
  asyncHandler(controller.clockOut)
);

router.patch(
  "/shifts/:shiftId/attendance",
  ...scopedExistingShiftMutation,
  asyncHandler(controller.updateAttendance)
);

export default router;
