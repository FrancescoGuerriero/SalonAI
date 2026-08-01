import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { disableSubscription, saveSubscription } from "./pushController.js";

const router = express.Router();
router.use(protect);
router.post("/subscriptions", asyncHandler(saveSubscription));
router.delete("/subscriptions", asyncHandler(disableSubscription));
export default router;
