import {
  Router,
} from "express";

import {
  getBookingLossAnalytics,
} from "./bookingLossController.js";

const router = Router();

router.get(
  "/",
  getBookingLossAnalytics
);

export default router;