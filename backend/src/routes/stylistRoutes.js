import express from "express";

import {
  getStylists,
  getStylist,
  createStylist,
  updateStylist,
  deleteStylist,
  toggleStylistStatus,
} from "../controllers/stylistController.js";

import {
  protect,
  adminOnly,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.get("/", getStylists);

router.get("/:id", getStylist);

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