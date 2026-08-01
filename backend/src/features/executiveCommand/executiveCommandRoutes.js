import { Router } from "express";
import { getExecutiveCommandCentre } from "./executiveCommandController.js";

const router = Router();
router.get("/", getExecutiveCommandCentre);
export default router;
