import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";

import * as aiController from "./aiController.js";

const router = express.Router();

const tenantRetentionChain = [
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions("ai:use"),
];

/*
|--------------------------------------------------------------------------
| Customer-retention prediction reporting
|--------------------------------------------------------------------------
|
| Static routes must appear before routes containing ":customerId".
| Retention AI is tenant-scoped even though the underlying prediction engine
| predates the canonical Business ownership rollout.
|
*/
router.get(
  "/retention/summary",
  ...tenantRetentionChain,
  asyncHandler(aiController.retentionSummary)
);
router.get(
  "/retention/predictions",
  ...tenantRetentionChain,
  asyncHandler(aiController.retentionPredictions)
);
router.post(
  "/retention/batch",
  ...tenantRetentionChain,
  asyncHandler(aiController.retentionBatch)
);

router
  .route("/customers/:customerId/retention")
  .get(
    ...tenantRetentionChain,
    asyncHandler(aiController.storedRetention)
  )
  .post(
    ...tenantRetentionChain,
    asyncHandler(aiController.retention)
  );

router.post(
  "/campaign-copy",
  asyncHandler(aiController.copy)
);

router
  .route("/revenue-forecast")
  .get(asyncHandler(aiController.latestForecast))
  .post(asyncHandler(aiController.forecast));

export default router;
