import { Router } from "express";
import { getSmartAppointmentRecommendations } from "./smartAppointmentController.js";

const router = Router();
router.get("/", getSmartAppointmentRecommendations);
export default router;
