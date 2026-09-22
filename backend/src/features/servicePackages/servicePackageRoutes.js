import express from "express";

import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./servicePackageController.js";

const router = express.Router();

router.get(
  "/",
  requirePermissions(
    "service:read"
  ),
  asyncHandler(
    controller.listDefinitions
  )
);

router.post(
  "/",
  requirePermissions(
    "service:create"
  ),
  asyncHandler(
    controller.createDefinition
  )
);

router.patch(
  "/:id",
  requirePermissions(
    "service:update"
  ),
  asyncHandler(
    controller.updateDefinition
  )
);

router.post(
  "/:id/entitlements",
  requirePermissions(
    "customer:update"
  ),
  asyncHandler(
    controller.grantEntitlement
  )
);

router.get(
  "/customers/:customerId",
  requirePermissions(
    "customer:read"
  ),
  asyncHandler(
    controller.customerEntitlements
  )
);

router.get(
  "/entitlements/:entitlementId/redemptions",
  requirePermissions(
    "customer:read"
  ),
  asyncHandler(
    controller.entitlementRedemptions
  )
);

router.post(
  "/entitlements/:entitlementId/redeem",
  requirePermissions(
    "appointment:update"
  ),
  asyncHandler(
    controller.redeemEntitlement
  )
);

router.post(
  "/redemptions/:redemptionId/reverse",
  requirePermissions(
    "appointment:update"
  ),
  asyncHandler(
    controller.reverseRedemption
  )
);

export default router;
