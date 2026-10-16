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
  week as tenantScopedWeek,
} from "./staffTenantController.js";
import {
  listTimeOff as tenantScopedTimeOffList,
} from "./staffTimeOffTenantController.js";

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
  readOwnSchedule,
  asyncHandler(
    controller.myWeek
  )
);

router.put(
  "/me/availability",
  updateOwnSchedule,
  asyncHandler(
    controller.setMyAvailability
  )
);

router.get(
  "/me/day",
  readOwnSchedule,
  asyncHandler(
    controller.myDay
  )
);

router.get(
  "/me/time-off",
  readOwnSchedule,
  asyncHandler(
    controller.listMyTimeOff
  )
);

router.post(
  "/me/time-off",
  requestOwnLeave,
  asyncHandler(
    controller.requestMyTimeOff
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
  updateEmployeeSchedule,
  asyncHandler(
    controller.updateTimeOff
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

router.post(
  "/:staffId/calendar-blocks",
  updateEmployeeSchedule,
  asyncHandler(
    controller.createCalendarBlock
  )
);

export default router;
