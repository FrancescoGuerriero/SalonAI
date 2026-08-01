import { Router } from "express";
import { getMarketingAttribution } from "./marketingAttributionController.js";

const router = Router();
router.get("/", getMarketingAttribution);
export default router;
