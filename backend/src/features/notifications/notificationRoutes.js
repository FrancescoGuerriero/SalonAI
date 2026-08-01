import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { managementOnly } from "../../../middleware/roleMiddleware.js";
import { listNotifications, queueNotification } from "./notificationController.js";

const router = express.Router();
router.use(protect);
router.use(managementOnly);
router.route("/").get(asyncHandler(listNotifications)).post(asyncHandler(queueNotification));
export default router;
