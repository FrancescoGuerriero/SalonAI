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
import * as controller from "./dynamicPricingController.js";

const router = Router();

router.use(trustedTenantContextMiddleware);
router.use(effectiveAuthorityMiddleware);

router.get(
  "/",
  requirePermissions("ai:use"),
  asyncHandler(controller.recommendations)
);

router.get(
  "/rules",
  requirePermissions("ai:use"),
  asyncHandler(controller.rules)
);
router.post(
  "/rules",
  requirePermissions("service:update"),
  asyncHandler(controller.createRule)
);
router.post(
  "/rules/:ruleId/review",
  requirePermissions("service:update"),
  asyncHandler(controller.reviewRule)
);

router.get(
  "/experiments",
  requirePermissions("ai:use"),
  asyncHandler(controller.experiments)
);
router.post(
  "/experiments",
  requirePermissions("service:update"),
  asyncHandler(controller.createExperiment)
);
router.post(
  "/experiments/:experimentId/run",
  requirePermissions("service:update"),
  asyncHandler(controller.runExperiment)
);

export default router;
