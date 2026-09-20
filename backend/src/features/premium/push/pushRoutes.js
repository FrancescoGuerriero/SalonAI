import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import {
  disableSubscription,
  listSubscriptions,
  saveSubscription,
} from "./pushController.js";
import {
  requirePermissions,
} from "../../../middleware/permissionMiddleware.js";

const router = express.Router();
router.use(protect);
router.get(
  "/subscriptions",
  requirePermissions(
    "push:manage"
  ),
  asyncHandler(
    listSubscriptions
  )
);
router.post("/subscriptions", asyncHandler(saveSubscription));
router.delete("/subscriptions", asyncHandler(disableSubscription));
export default router;
