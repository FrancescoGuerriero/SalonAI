import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { requirePermissions } from "../../../middleware/permissionMiddleware.js";
import { listNotifications, queueNotification } from "./notificationController.js";

const router = express.Router();
router.use(protect);
router.use(requirePermissions("notification:manage"));
router.route("/").get(asyncHandler(listNotifications)).post(asyncHandler(queueNotification));
export default router;
