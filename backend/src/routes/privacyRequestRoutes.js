import express from "express";

import asyncHandler from "../middleware/asyncHandler.js";
import {
  adminOnly,
  protect,
} from "../middleware/authMiddleware.js";
import {
  createMyPrivacyRequest,
  listMyPrivacyRequests,
  listPrivacyRequests,
  updatePrivacyRequest,
} from "../controllers/privacyRequestController.js";

const router =
  express.Router();

router.use(protect);

router.get(
  "/me",
  asyncHandler(
    listMyPrivacyRequests
  )
);

router.post(
  "/me",
  asyncHandler(
    createMyPrivacyRequest
  )
);

router.get(
  "/management",
  adminOnly,
  asyncHandler(
    listPrivacyRequests
  )
);

router.patch(
  "/management/:id",
  adminOnly,
  asyncHandler(
    updatePrivacyRequest
  )
);

export default router;
