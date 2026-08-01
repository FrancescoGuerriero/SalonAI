import { Router } from "express";
import { getCapacityPlan } from "./capacityPlanningController.js";

const router = Router();
router.get("/", getCapacityPlan);
export default router;
