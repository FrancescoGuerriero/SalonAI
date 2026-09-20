import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { requirePermissions } from "../../../middleware/permissionMiddleware.js";
import { issueGiftCard, listGiftCards, redeemGiftCard } from "./giftCardController.js";

const router = express.Router();
router.use(protect);
router.post("/", requirePermissions("gift-card:manage"), asyncHandler(issueGiftCard));
router.post("/redeem", requirePermissions("gift-card:manage"), asyncHandler(redeemGiftCard));
router.get("/", requirePermissions("gift-card:manage"), asyncHandler(listGiftCards));
export default router;
