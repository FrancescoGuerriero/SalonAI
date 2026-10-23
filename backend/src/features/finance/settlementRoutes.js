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
import * as controller from "./settlementController.js";

const router = Router();

router.use(trustedTenantContextMiddleware);
router.use(effectiveAuthorityMiddleware);

router.get(
  "/summary",
  requirePermissions("reports:read"),
  asyncHandler(controller.summary)
);
router.get(
  "/obligations",
  requirePermissions("reports:read"),
  asyncHandler(controller.obligations)
);
router.post(
  "/projection",
  requirePermissions("reports:manage"),
  asyncHandler(controller.projectPending)
);
router.post(
  "/projection/:ledgerEntryId",
  requirePermissions("reports:manage"),
  asyncHandler(controller.projectLedgerEntry)
);
router.patch(
  "/obligations/:obligationId/review",
  requirePermissions("reports:manage"),
  asyncHandler(controller.reviewObligation)
);
router.get(
  "/batches",
  requirePermissions("reports:read"),
  asyncHandler(controller.batches)
);
router.post(
  "/batches",
  requirePermissions("reports:manage"),
  asyncHandler(controller.createBatch)
);
router.patch(
  "/batches/:batchId/review",
  requirePermissions("reports:manage"),
  asyncHandler(controller.reviewBatch)
);

export default router;
