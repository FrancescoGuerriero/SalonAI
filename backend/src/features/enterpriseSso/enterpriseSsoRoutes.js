import express from "express";

import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./enterpriseSsoController.js";

const router = express.Router();

router.use(trustedTenantContextMiddleware);
router.use(effectiveAuthorityMiddleware);

router.get(
  "/",
  requirePermissions("feature-control:read"),
  asyncHandler(controller.list)
);
router.post(
  "/",
  requirePermissions("feature-control:update"),
  asyncHandler(controller.create)
);
router.patch(
  "/:connectionId",
  requirePermissions("feature-control:update"),
  asyncHandler(controller.update)
);
router.post(
  "/:connectionId/readiness",
  requirePermissions("feature-control:update"),
  asyncHandler(controller.readiness)
);

export default router;
