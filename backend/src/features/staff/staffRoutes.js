import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
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
import {
  setAvailability as tenantScopedSetAvailability,
  week as tenantScopedWeek,
} from "./staffTenantController.js";
import {
  listTimeOff as tenantScopedTimeOffList,
  requestTimeOff as tenantScopedRequestTimeOff,
  updateTimeOff as tenantScopedUpdateTimeOff,
} from "./staffTimeOffTenantController.js";
import {
  listMyTimeOff as tenantScopedListMyTimeOff,
  myWeek as tenantScopedMyWeek,
  requestMyTimeOff as tenantScopedRequestMyTimeOff,
  setMyAvailability as tenantScopedSetMyAvailability,
} from "./staffSelfServiceTenantController.js";
import * as controller from "./staffScheduleTenantController.js";

const tenantScopedMyDay = controller.myDay;
const tenantScopedStaffDay = controller.staffDay;

const router = express.Router();

const readEmployees = requirePermissions("employee:read");
const updateEmployeeSchedule = requirePermissions("employee:schedule:update");
const readCalendar = requirePermissions("appointment:read");

const workforceTenantAuthority = [
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
];

const readOwnSchedule = requirePermissions("schedule:own:read");
const updateOwnSchedule = requirePermissions("schedule:own:update");
const requestOwnLeave = requirePermissions("leave:own:request");

router.get(
  "/me/availability",
  ...workforceTenantAuthority,
  readOwnSchedule,
  asyncHandler(tenantScopedMyWeek)
);

router.put(
  "/me/availability",
  ...workforceTenantAuthority,
  updateOwnSchedule,
  asyncHandler(tenantScopedSetMyAvailability)
);

router.get(
  "/me/day",
  ...workforceTenantAuthority,
  readOwnSchedule,
  asyncHandler(tenantScopedMyDay)
);

router.get(
  "/me/time-off",
  ...workforceTenantAuthority,
  readOwnSchedule,
  asyncHandler(tenantScopedListMyTimeOff)
);

router.post(
  "/me/time-off",
  ...workforceTenantAuthority,
  requestOwnLeave,
  asyncHandler(tenantScopedRequestMyTimeOff)
);

router.get(
  "/time-off",
  ...workforceTenantAuthority,
  readEmployees,
  asyncHandler(tenantScopedTimeOffList)
);

router.patch(
  "/time-off/:id",
  ...workforceTenantAuthority,
  updateEmployeeSchedule,
  asyncHandler(tenantScopedUpdateTimeOff)
);

router.get(
  "/calendar-blocks",
  ...workforceTenantAuthority,
  readCalendar,
  asyncHandler(controller.listCalendarBlocks)
);

router.patch(
  "/calendar-blocks/:id/cancel",
  ...workforceTenantAuthority,
  updateEmployeeSchedule,
  asyncHandler(controller.cancelCalendarBlock)
);

router.get(
  "/:staffId/availability",
  ...workforceTenantAuthority,
  readEmployees,
  asyncHandler(tenantScopedWeek)
);

router.put(
  "/:staffId/availability",
  ...workforceTenantAuthority,
  updateEmployeeSchedule,
  asyncHandler(tenantScopedSetAvailability)
);

router.get(
  "/:staffId/day",
  ...workforceTenantAuthority,
  readEmployees,
  asyncHandler(tenantScopedStaffDay)
);

router.post(
  "/:staffId/time-off",
  ...workforceTenantAuthority,
  updateEmployeeSchedule,
  asyncHandler(tenantScopedRequestTimeOff)
);

router.post(
  "/:staffId/calendar-blocks",
  ...workforceTenantAuthority,
  updateEmployeeSchedule,
  asyncHandler(controller.createCalendarBlock)
);

export default router;
