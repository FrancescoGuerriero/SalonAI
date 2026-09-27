import express from "express";

import {
  createService,
  deleteService,
  getManagementServices,
  getServiceById,
  getServices,
  updateService,
  updateServicePublication,
} from "../controllers/serviceController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
  servicePublicTenantContextMiddleware,
} from "../middleware/serviceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../platform/tenancy/trustedTenantMiddleware.js";

const router = express.Router();

const protectedServiceTenantChain = [
  protect,
  servicePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
];

// Customers browse published services only for the Business resolved from
// the server-trusted request host.
router.get(
  "/",
  servicePublicTenantContextMiddleware,
  getServices
);

// Management catalogue includes published and unpublished records, but only
// inside the trusted BusinessMembership/effective-authority tenant scope.
router.get(
  "/management",
  ...protectedServiceTenantChain,
  requirePermissions(
    "service:read"
  ),
  getManagementServices
);

router.post(
  "/",
  ...protectedServiceTenantChain,
  requirePermissions(
    "service:create"
  ),
  createService
);

router.patch(
  "/:id/publication",
  ...protectedServiceTenantChain,
  requirePermissions(
    "service:publish"
  ),
  updateServicePublication
);

router.put(
  "/:id",
  ...protectedServiceTenantChain,
  requirePermissions(
    "service:update"
  ),
  updateService
);

// Hard deletion remains Super-Admin-only through the canonical permission
// registry; unpublish is the normal lifecycle.
router.delete(
  "/:id",
  ...protectedServiceTenantChain,
  requirePermissions(
    "service:delete"
  ),
  deleteService
);

router.get(
  "/:id",
  servicePublicTenantContextMiddleware,
  getServiceById
);

export default router;
