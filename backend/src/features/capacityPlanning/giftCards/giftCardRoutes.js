import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { managementOnly } from "../../../middleware/roleMiddleware.js";
import { issueGiftCard, listGiftCards, redeemGiftCard } from "./giftCardController.js";

const router = express.Router();
router.use(protect);
router.post("/", asyncHandler(issueGiftCard));
router.post("/redeem", asyncHandler(redeemGiftCard));
router.get("/", managementOnly, asyncHandler(listGiftCards));
export default router;
