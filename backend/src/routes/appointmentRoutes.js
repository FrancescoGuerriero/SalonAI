import express from "express";

import {
  createAppointment,
  createAppointmentPaymentCheckout,
  getAppointments,
} from "../controllers/appointmentController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";

import {
  appointmentLifecycleNotification,
} from "../features/appointments/appointmentLifecycleNotificationMiddleware.js";
import { requireFeature } from "../services/featureControlService.js";

const router = express.Router();

const managementRoles = new Set([
  "super_admin",
  "admin",
  "manager",
  "receptionist",
  "stylist",
]);
const requireCustomerOnlineBooking = requireFeature("online-booking");

function requireOnlineBookingForCustomer(request, response, next) {
  if (managementRoles.has(request.user?.role)) {
    return next();
  }

  return requireCustomerOnlineBooking(request, response, next);
}

router.use(protect);

router.get(
  "/",
  getAppointments
);

router.post(
  "/",
  requireOnlineBookingForCustomer,
  appointmentLifecycleNotification("created"),
  createAppointment
);

router.post(
  "/:id/payments/checkout",
  createAppointmentPaymentCheckout
);

export default router;
