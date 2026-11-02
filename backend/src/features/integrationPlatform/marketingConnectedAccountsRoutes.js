import express from "express";

import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  requireCommercialModule,
} from "../../middleware/commercialModuleEntitlementMiddleware.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./marketingConnectedAccountsController.js";
import * as dataConnectionController from "./dataConnectionController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");
const dataConnectionTenantChain = [
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requireCommercialModule("seller-marketplace"),
];

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/accounts", read, asyncHandler(controller.accounts));
router.put("/accounts/:provider", write, asyncHandler(controller.configure));
router.post("/accounts/:provider/verify", write, asyncHandler(controller.verify));
router.post("/accounts/:provider/disconnect", write, asyncHandler(controller.disconnect));

// Point 12 AIIBP managed data-connection layer. These tenant-owned operations
// require the Seller & Marketplace Management commercial module in addition to
// the existing RBAC permission. The shared Connections workspace remains a
// platform integration surface and is intentionally not gated here.
router.get(
  "/data-connections/catalogue",
  ...dataConnectionTenantChain,
  read,
  asyncHandler(dataConnectionController.catalogue)
);
router.post(
  "/data-connections/:connector/authorize",
  ...dataConnectionTenantChain,
  write,
  asyncHandler(dataConnectionController.authorize)
);
router.post(
  "/data-connections/:connector/reconcile",
  ...dataConnectionTenantChain,
  write,
  asyncHandler(dataConnectionController.reconcile)
);
router.get(
  "/data-connections/:connector/fields",
  ...dataConnectionTenantChain,
  read,
  asyncHandler(dataConnectionController.fields)
);
router.get(
  "/data-connections/:connector/profiles",
  ...dataConnectionTenantChain,
  read,
  asyncHandler(dataConnectionController.profiles)
);
router.post(
  "/data-connections/:connector/preview",
  ...dataConnectionTenantChain,
  read,
  asyncHandler(dataConnectionController.preview)
);
router.post(
  "/data-connections/:connector/import",
  ...dataConnectionTenantChain,
  write,
  asyncHandler(dataConnectionController.importToDataHub)
);
router.post(
  "/data-connections/:connector/backfill",
  ...dataConnectionTenantChain,
  write,
  asyncHandler(dataConnectionController.backfill)
);
router.get(
  "/data-connections/:connector/seller-kpis",
  ...dataConnectionTenantChain,
  read,
  asyncHandler(dataConnectionController.sellerKpis)
);
router.delete(
  "/data-connections/:connector/accounts/:accountId",
  ...dataConnectionTenantChain,
  write,
  asyncHandler(dataConnectionController.unlinkAccount)
);

export default router;
