import express from "express";

import {
  createAppointment,
  createAppointmentPaymentCheckout,
  getAppointments
} from "../controllers/appointmentController.js";

import {
  protect
} from "../middleware/authMiddleware.js";
import {
  notifyAfterResponse,
} from "../features/appointments/appointmentLifecycleNotificationMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getAppointments);
router.post(
  "/",
  notifyAfterResponse("created"),
  createAppointment
);
router.post(
  "/:id/payments/checkout",
  createAppointmentPaymentCheckout
);

export default router;
