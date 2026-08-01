import { Router } from "express";
import { getDynamicPricingRecommendations } from "./dynamicPricingController.js";

const router = Router();
router.get("/", getDynamicPricingRecommendations);
export default router;
