import express from "express";

import asyncHandler from "../middleware/asyncHandler.js";
import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  createMyPrivacyRequest,
  exportMyPrivacyData,
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

router.get(
  "/me/export",
  asyncHandler(
    exportMyPrivacyData
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
  requirePermissions(
    "privacy-request:manage"
  ),
  asyncHandler(
    listPrivacyRequests
  )
);

router.patch(
  "/management/:id",
  requirePermissions(
    "privacy-request:manage"
  ),
  asyncHandler(
    updatePrivacyRequest
  )
);

export default router;
