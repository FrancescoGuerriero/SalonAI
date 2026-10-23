import { Router } from "express";

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
import * as controller from "./benchmarkController.js";

const router = Router();

router.use(trustedTenantContextMiddleware);
router.use(effectiveAuthorityMiddleware);

router.get(
  "/participation",
  requirePermissions("benchmark:read"),
  asyncHandler(controller.participation)
);
router.post(
  "/participation",
  requirePermissions("benchmark:manage"),
  asyncHandler(controller.recordParticipation)
);
router.post(
  "/contributions/refresh",
  requirePermissions("benchmark:manage"),
  asyncHandler(controller.refreshContribution)
);
router.get(
  "/contributions/own",
  requirePermissions("benchmark:read"),
  asyncHandler(controller.ownContribution)
);
router.get(
  "/cohort",
  requirePermissions("benchmark:read"),
  asyncHandler(controller.cohort)
);

export default router;
