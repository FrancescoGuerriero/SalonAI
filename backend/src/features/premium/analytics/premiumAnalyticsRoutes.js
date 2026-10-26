import express from "express";
import asyncHandler from "../../../middleware/asyncHandler.js";
import { protect } from "../../../middleware/authMiddleware.js";
import { effectiveAuthorityMiddleware, requireEffectivePermissions } from "../../../middleware/effectiveAuthorityMiddleware.js";
import { requirePermissions } from "../../../middleware/permissionMiddleware.js";
import { workforcePublicTenantContextMiddleware } from "../../../middleware/workforceTenantMiddleware.js";
import { trustedTenantContextMiddleware } from "../../../platform/tenancy/trustedTenantMiddleware.js";
import { getManagementBi, getManagementPythonAnalysis, getPremiumAnalytics } from "./premiumAnalyticsController.js";

const router = express.Router();
router.use(protect);

router.get(
  "/",
  requirePermissions("premium-analytics:read"),
  asyncHandler(getPremiumAnalytics)
);

router.get(
  "/management",
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requireEffectivePermissions("premium-analytics:read"),
  asyncHandler(getManagementBi)
);

router.post(
  "/management/python-analysis",
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requireEffectivePermissions("premium-analytics:read", "ai:use"),
  asyncHandler(getManagementPythonAnalysis)
);

export default router;
