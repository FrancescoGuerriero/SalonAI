import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { managementOnly } from "../../../middleware/roleMiddleware.js";
import { createReferral, getMyReferrals, listReferrals, qualifyReferral } from "./referralController.js";

const router = express.Router();
router.use(protect);
router.get("/me", asyncHandler(getMyReferrals));
router.post("/", asyncHandler(createReferral));
router.get("/", managementOnly, asyncHandler(listReferrals));
router.post("/:referralId/qualify", managementOnly, asyncHandler(qualifyReferral));
export default router;
