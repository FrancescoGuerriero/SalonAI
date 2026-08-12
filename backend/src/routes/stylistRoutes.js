import express from "express";

import {
  getStylists,
  getPublicStylists,
  getStylist,
  getStylistAvailability,
  getMyStylistProfile,
  updateMyStylistProfile,
  createStylist,
  updateStylist,
  deleteStylist,
  toggleStylistStatus,
} from "../controllers/stylistController.js";

import {
  protect,
  adminOnly,
  managementOnly,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/public",
  getPublicStylists
);

router.get(
  "/",
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
  getMyStylistProfile
);

router.patch(
  "/me/profile",
  protect,
  managementOnly,
  updateMyStylistProfile
);

/*
|--------------------------------------------------------------------------
| Public booking routes
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/availability",
  getStylistAvailability
);

router.get(
  "/:id",
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
