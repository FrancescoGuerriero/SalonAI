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
} from "../controllers/stylistController.js";
import {
  getMyStaffProfile,
  updateMyStaffProfile,
} from "../controllers/staffSelfProfileController.js";

import {
  protect,
  superAdminOnly,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import { requireFeature } from "../services/featureControlService.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/public",
  requireFeature("public-team"),
  getPublicStylists
);

router.get(
  "/booking",
  requireFeature("online-booking"),
  getBookingStylists
);

router.get(
  "/",
  protect,
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
  protect,
  requirePermissions(
    "profile:own:read"
  ),
  getMyStaffProfile
);

router.patch(
  "/me/profile",
  protect,
  requirePermissions(
    "profile:own:update"
  ),
  updateMyStaffProfile
);

/*
|--------------------------------------------------------------------------
| Public booking routes
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/availability",
  requireFeature("online-booking"),
  getStylistAvailability
);

router.get(
  "/:id",
  protect,
  requirePermissions(
    "profile:all:read"
  ),
  getStylist
);

/*
|--------------------------------------------------------------------------
| Admin Routes
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  protect,
  superAdminOnly,
  createStylist
);

router.put(
  "/:id",
  protect,
  requirePermissions(
    "profile:all:update"
  ),
  updateStylist
);

router.delete(
  "/:id",
  protect,
  superAdminOnly,
  deleteStylist
);

router.patch(
  "/:id/status",
  protect,
  requirePermissions(
    "profile:all:update"
  ),
  toggleStylistStatus
);

export default router;
