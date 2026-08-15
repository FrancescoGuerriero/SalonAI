import express from "express";

import {
  createAppointment,
  getAppointments
} from "../controllers/appointmentController.js";

import {
  protect
} from "../middleware/authMiddleware.js";

import {
  appointmentLifecycleNotification,
} from "../features/appointments/appointmentLifecycleNotificationMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getAppointments);
router.post(
  "/",
  appointmentLifecycleNotification("created"),
  createAppointment
);

export default router;
