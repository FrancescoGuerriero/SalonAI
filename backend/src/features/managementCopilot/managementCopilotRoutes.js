import { Router } from "express";
import { getManagementCopilotBrief } from "./managementCopilotController.js";

const router = Router();
router.get("/", getManagementCopilotBrief);
export default router;
