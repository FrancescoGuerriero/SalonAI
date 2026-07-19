import express from "express";

import {
  createAppointment,
  getAppointments
} from "../controllers/appointmentController.js";

import {
  protect
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getAppointments);
router.post("/", createAppointment);

export default router;