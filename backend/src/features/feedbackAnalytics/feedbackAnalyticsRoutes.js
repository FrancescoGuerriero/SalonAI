import { Router } from "express";
import {
  createFeedbackRecord,
  listFeedbackAnalytics,
  updateFeedbackResolution,
} from "./feedbackAnalyticsController.js";

const router = Router();
router.get("/", listFeedbackAnalytics);
router.post("/", createFeedbackRecord);
router.patch("/:feedbackId/resolve", updateFeedbackResolution);
export default router;
