import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { requirePermissions } from "../../../middleware/permissionMiddleware.js";
import { createReferral, getMyReferrals, listReferrals, qualifyReferral } from "./referralController.js";

const router = express.Router();
router.use(protect);
router.get("/me", asyncHandler(getMyReferrals));
router.post("/", asyncHandler(createReferral));
router.get("/", requirePermissions("referral:manage"), asyncHandler(listReferrals));
router.post("/:referralId/qualify", requirePermissions("referral:manage"), asyncHandler(qualifyReferral));
export default router;
