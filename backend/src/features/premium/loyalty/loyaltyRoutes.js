import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { requirePermissions } from "../../../middleware/permissionMiddleware.js";
import { awardPoints, getMyLoyalty, listLoyaltyAccounts, redeemPoints } from "./loyaltyController.js";

const router = express.Router();
router.use(protect);
router.get("/me", asyncHandler(getMyLoyalty));
router.get("/", requirePermissions("loyalty:manage"), asyncHandler(listLoyaltyAccounts));
router.post("/:customerId/award", requirePermissions("loyalty:manage"), asyncHandler(awardPoints));
router.post("/:customerId/redeem", requirePermissions("loyalty:manage"), asyncHandler(redeemPoints));
export default router;
