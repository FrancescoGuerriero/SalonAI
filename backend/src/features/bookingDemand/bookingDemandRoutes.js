import {
  Router,
} from "express";

import {
  getBookingDemandAnalytics,
} from "./bookingDemandController.js";

const router = Router();

router.get(
  "/",
  getBookingDemandAnalytics
);

export default router;