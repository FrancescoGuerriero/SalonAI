import { Router } from "express";

import {
  superAdminOnly,
} from "../../middleware/authMiddleware.js";
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
import * as controller from "./partnerMarketplaceController.js";

const router = Router();

router.get(
  "/catalogue",
  requirePermissions("feature-control:read"),
  asyncHandler(controller.catalogue)
);

/*
 * Partner-developer identity/provisioning is not yet a platform primitive.
 * Until it is, submission intake and catalogue approval remain explicit
 * Super Admin actions rather than being delegated to arbitrary tenant users.
 */
router.get(
  "/submissions",
  superAdminOnly,
  asyncHandler(controller.submissions)
);
router.post(
  "/submissions",
  superAdminOnly,
  asyncHandler(controller.submit)
);
router.post(
  "/submissions/:appId/review",
  superAdminOnly,
  asyncHandler(controller.review)
);

const tenant = Router();
tenant.use(trustedTenantContextMiddleware);
tenant.use(effectiveAuthorityMiddleware);

tenant.get(
  "/installations",
  requirePermissions("feature-control:read"),
  asyncHandler(controller.installations)
);
tenant.post(
  "/apps/:appId/installations",
  requirePermissions("feature-control:update"),
  asyncHandler(controller.prepareInstallation)
);
tenant.post(
  "/installations/:installationId/reconcile",
  requirePermissions("feature-control:update"),
  asyncHandler(controller.reconcileInstallation)
);

router.use(tenant);

export default router;
