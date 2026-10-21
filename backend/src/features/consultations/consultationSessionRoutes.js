import express from "express";

import { protect } from "../../middleware/authMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./consultationSessionController.js";

const router = express.Router();

router.use(
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware
);

router.get(
  "/",
  requirePermissions("consultation:read"),
  asyncHandler(controller.list)
);

router.post(
  "/",
  requirePermissions("consultation:create"),
  asyncHandler(controller.create)
);

router.get(
  "/:consultationId",
  requirePermissions("consultation:read"),
  asyncHandler(controller.getById)
);

router.patch(
  "/:consultationId",
  requirePermissions("consultation:update"),
  asyncHandler(controller.update)
);

router.post(
  "/:consultationId/assign",
  requirePermissions("consultation:assign"),
  asyncHandler(controller.assignReviewer)
);

router.post(
  "/:consultationId/recommendation",
  requirePermissions("consultation:review"),
  asyncHandler(controller.recommend)
);

router.post(
  "/:consultationId/review",
  requirePermissions("consultation:review"),
  asyncHandler(controller.review)
);

router.post(
  "/:consultationId/approve",
  requirePermissions("consultation:approve"),
  asyncHandler(controller.approve)
);

router.post(
  "/:consultationId/book",
  requirePermissions("consultation:approve", "appointment:create"),
  asyncHandler(controller.book)
);

router.post(
  "/:consultationId/assist",
  requirePermissions("consultation:update", "ai:use"),
  asyncHandler(controller.assist)
);

export default router;
