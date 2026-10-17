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
import * as controller from "./staffController.js";
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

const router = express.Router();

const readEmployees =
  requirePermissions(
    "employee:read"
  );

const updateEmployeeSchedule =
  requirePermissions(
    "employee:schedule:update"
  );

const readCalendar =
  requirePermissions(
    "appointment:read"
  );

const workforceTenantAuthority = [
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
];

const readOwnSchedule =
  requirePermissions(
    "schedule:own:read"
  );

const updateOwnSchedule =
  requirePermissions(
    "schedule:own:update"
  );

const requestOwnLeave =
  requirePermissions(
    "leave:own:request"
  );

// Self-service routes must be declared before /:staffId routes.
router.get(
  "/me/availability",
  ...workforceTenantAuthority,
  readOwnSchedule,
  asyncHandler(
    tenantScopedMyWeek
  )
);

router.put(
  "/me/availability",
  ...workforceTenantAuthority,
  updateOwnSchedule,
  asyncHandler(
    tenantScopedSetMyAvailability
  )
);

// Appointment-backed self day remains on the legacy service until #380.
router.get(
  "/me/day",
  readOwnSchedule,
  asyncHandler(
    controller.myDay
  )
);

router.get(
  "/me/time-off",
  ...workforceTenantAuthority,
  readOwnSchedule,
  asyncHandler(
    tenantScopedListMyTimeOff
  )
);

router.post(
  "/me/time-off",
  ...workforceTenantAuthority,
  requestOwnLeave,
  asyncHandler(
    tenantScopedRequestMyTimeOff
  )
);

// Cross-employee management routes.
router.get(
  "/time-off",
  ...workforceTenantAuthority,
  readEmployees,
  asyncHandler(
    tenantScopedTimeOffList
  )
);

router.patch(
  "/time-off/:id",
  ...workforceTenantAuthority,
  updateEmployeeSchedule,
  asyncHandler(
    tenantScopedUpdateTimeOff
  )
);

router.get(
  "/calendar-blocks",
  readCalendar,
  asyncHandler(
    controller.listCalendarBlocks
  )
);

router.patch(
  "/calendar-blocks/:id/cancel",
  updateEmployeeSchedule,
  asyncHandler(
    controller.cancelCalendarBlock
  )
);

router.get(
  "/:staffId/availability",
  ...workforceTenantAuthority,
  readEmployees,
  asyncHandler(
    tenantScopedWeek
  )
);

router.put(
  "/:staffId/availability",
  ...workforceTenantAuthority,
  updateEmployeeSchedule,
  asyncHandler(
    tenantScopedSetAvailability
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
  ...workforceTenantAuthority,
  updateEmployeeSchedule,
  asyncHandler(
    tenantScopedRequestTimeOff
  )
);

router.post(
  "/:staffId/calendar-blocks",
  updateEmployeeSchedule,
  asyncHandler(
    controller.createCalendarBlock
  )
);

export default router;
