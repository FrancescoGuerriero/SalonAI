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
  adminOnly,
  managementOnly,
} from "../middleware/authMiddleware.js";
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
  managementOnly,
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
  managementOnly,
  getMyStaffProfile
);

router.patch(
  "/me/profile",
  protect,
  managementOnly,
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
  managementOnly,
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
  adminOnly,
  createStylist
);

router.put(
  "/:id",
  protect,
  adminOnly,
  updateStylist
);

router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteStylist
);

router.patch(
  "/:id/status",
  protect,
  adminOnly,
  toggleStylistStatus
);

export default router;
