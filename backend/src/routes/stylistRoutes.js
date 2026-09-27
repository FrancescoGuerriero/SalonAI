import express from "express";

import {
  getStylists,
  getPublicStylists,
  getBookingStylists,
  getStylist,
  getStylistAvailability,
  createStylist,
  updateStylist,
  deleteStylist,
  toggleStylistStatus,
  validateStylistAvailabilityIdentifiers,
} from "../controllers/stylistController.js";
import {
  getMyStaffProfile,
  updateMyStaffProfile,
} from "../controllers/staffSelfProfileController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../platform/tenancy/trustedTenantMiddleware.js";
import {
  requireFeature,
} from "../services/featureControlService.js";

const router = express.Router();

const protectedWorkforceTenantChain = [
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
];

function validateAvailabilityIdentifiers(
  request,
  response,
  next
) {
  try {
    validateStylistAvailabilityIdentifiers(
      request
    );
    return next();
  } catch (error) {
    return next(
      error
    );
  }
}

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
| Public team and booking data are scoped to the Business resolved from the
| server-trusted request host. Raw client Business/Location ids are ignored.
*/

router.get(
  "/public",
  requireFeature(
    "public-team"
  ),
  workforcePublicTenantContextMiddleware,
  getPublicStylists
);

router.get(
  "/booking",
  requireFeature(
    "online-booking"
  ),
  workforcePublicTenantContextMiddleware,
  getBookingStylists
);

/*
|--------------------------------------------------------------------------
| Management catalogue
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  ...protectedWorkforceTenantChain,
  requirePermissions(
    "profile:all:read"
  ),
  getStylists
);

/*
|--------------------------------------------------------------------------
| Staff self-service profile routes
|--------------------------------------------------------------------------
*/

router.get(
  "/me/profile",
  ...protectedWorkforceTenantChain,
  requirePermissions(
    "profile:own:read"
  ),
  getMyStaffProfile
);

router.patch(
  "/me/profile",
  ...protectedWorkforceTenantChain,
  requirePermissions(
    "profile:own:update"
  ),
  updateMyStaffProfile
);

/*
|--------------------------------------------------------------------------
| Public booking-safe availability
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/availability",
  requireFeature(
    "online-booking"
  ),
  validateAvailabilityIdentifiers,
  workforcePublicTenantContextMiddleware,
  getStylistAvailability
);

/*
|--------------------------------------------------------------------------
| Tenant-scoped employee management
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  ...protectedWorkforceTenantChain,
  requirePermissions(
    "profile:all:read"
  ),
  getStylist
);

router.post(
  "/",
  ...protectedWorkforceTenantChain,
  requirePermissions(
    "employee:create"
  ),
  createStylist
);

router.put(
  "/:id",
  ...protectedWorkforceTenantChain,
  requirePermissions(
    "profile:all:update"
  ),
  updateStylist
);

router.delete(
  "/:id",
  ...protectedWorkforceTenantChain,
  requirePermissions(
    "employee:delete"
  ),
  deleteStylist
);

router.patch(
  "/:id/status",
  ...protectedWorkforceTenantChain,
  requirePermissions(
    "profile:all:update"
  ),
  toggleStylistStatus
);

export default router;
