import express from "express";

import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  requireAnyCommercialModule,
  requireCommercialModule,
} from "../../middleware/commercialModuleEntitlementMiddleware.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import { dataConnection } from "./dataConnectionCatalogue.js";
import * as controller from "./marketingConnectedAccountsController.js";
import * as dataConnectionController from "./dataConnectionController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");

const dataConnectionTenantAuthority = [
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
];

const requireMarketingDataConnection =
  requireCommercialModule("marketing");
const requireSellerDataConnection =
  requireCommercialModule("seller-marketplace");
const requireDataConnectionCatalogue =
  requireAnyCommercialModule("marketing", "seller-marketplace");

function requireDataConnectionEntitlement(request, response, next) {
  const connectorKey = String(request.params?.connector || "")
    .trim()
    .toLowerCase();
  const entry = dataConnection(connectorKey);

  if (entry?.kind === "seller") {
    return requireSellerDataConnection(request, response, next);
  }

  return requireMarketingDataConnection(request, response, next);
}

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/accounts", read, asyncHandler(controller.accounts));
router.put("/accounts/:provider", write, asyncHandler(controller.configure));
router.post("/accounts/:provider/verify", write, asyncHandler(controller.verify));
router.post("/accounts/:provider/disconnect", write, asyncHandler(controller.disconnect));

// Point 12 AIIBP managed data-connection layer. Marketing sources require the
// Marketing commercial module. Seller connectors retain the independent
// Seller & Marketplace Management entitlement. The shared catalogue can be
// opened by either module so both products can reuse one provider-neutral
// connection surface without creating duplicate commercial workspaces.
router.get(
  "/data-connections/catalogue",
  ...dataConnectionTenantAuthority,
  requireDataConnectionCatalogue,
  read,
  asyncHandler(dataConnectionController.catalogue)
);
router.post(
  "/data-connections/:connector/authorize",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  write,
  asyncHandler(dataConnectionController.authorize)
);
router.post(
  "/data-connections/:connector/reconcile",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  write,
  asyncHandler(dataConnectionController.reconcile)
);
router.get(
  "/data-connections/:connector/fields",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  read,
  asyncHandler(dataConnectionController.fields)
);
router.get(
  "/data-connections/:connector/profiles",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  read,
  asyncHandler(dataConnectionController.profiles)
);
router.post(
  "/data-connections/:connector/preview",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  read,
  asyncHandler(dataConnectionController.preview)
);
router.post(
  "/data-connections/:connector/import",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  write,
  asyncHandler(dataConnectionController.importToDataHub)
);
router.post(
  "/data-connections/:connector/backfill",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  write,
  asyncHandler(dataConnectionController.backfill)
);
router.get(
  "/data-connections/:connector/seller-kpis",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  read,
  asyncHandler(dataConnectionController.sellerKpis)
);
router.delete(
  "/data-connections/:connector/accounts/:accountId",
  ...dataConnectionTenantAuthority,
  requireDataConnectionEntitlement,
  write,
  asyncHandler(dataConnectionController.unlinkAccount)
);

export default router;
