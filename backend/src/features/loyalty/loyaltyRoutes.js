import express from "express";
import asyncHandler from "../../middleware/asyncHandler.js";
import { protect } from "../../middleware/authMiddleware.js";
import { managementOnly } from "../../middleware/roleMiddleware.js";
import { awardPoints, getMyLoyalty, listLoyaltyAccounts, redeemPoints } from "./loyaltyController.js";

const router = express.Router();
router.use(protect);
router.get("/me", asyncHandler(getMyLoyalty));
router.get("/", managementOnly, asyncHandler(listLoyaltyAccounts));
router.post("/:customerId/award", managementOnly, asyncHandler(awardPoints));
router.post("/:customerId/redeem", managementOnly, asyncHandler(redeemPoints));
export default router;
