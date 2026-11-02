import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  requireCommercialModule,
} from "../../middleware/commercialModuleEntitlementMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import {
  benefitBalances,
  collectContract,
  contract,
  contracts,
  createContract,
  createPlan,
  freezeContract,
  issueBenefits,
  plans,
  redeemBenefit,
  resumeContract,
  updateContract,
  updatePlan,
} from "./membershipController.js";

const router = express.Router();

/*
 * The parent future-feature router establishes authenticated staff identity.
 * Membership operations then bind that identity to trusted Business authority,
 * require the Memberships commercial entitlement and only afterwards evaluate
 * the operation-specific customer RBAC permission.
 */
router.use(
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requireCommercialModule("memberships")
);

router.get("/plans", requirePermissions("customer:read"), asyncHandler(plans));
router.post("/plans", requirePermissions("customer:update"), asyncHandler(createPlan));
router.patch(
  "/plans/:planId",
  requirePermissions("customer:update"),
  asyncHandler(updatePlan)
);

router.get(
  "/contracts",
  requirePermissions("customer:read"),
  asyncHandler(contracts)
);
router.post(
  "/contracts",
  requirePermissions("customer:update"),
  asyncHandler(createContract)
);
router.get(
  "/contracts/:id",
  requirePermissions("customer:read"),
  asyncHandler(contract)
);
router.patch(
  "/contracts/:id",
  requirePermissions("customer:update"),
  asyncHandler(updateContract)
);
router.post(
  "/contracts/:id/freeze",
  requirePermissions("customer:update"),
  asyncHandler(freezeContract)
);
router.post(
  "/contracts/:id/resume",
  requirePermissions("customer:update"),
  asyncHandler(resumeContract)
);
router.post(
  "/contracts/:id/collections",
  requirePermissions("customer:update"),
  asyncHandler(collectContract)
);
router.get(
  "/contracts/:id/benefits",
  requirePermissions("customer:read"),
  asyncHandler(benefitBalances)
);
router.post(
  "/contracts/:id/benefits/issue",
  requirePermissions("customer:update"),
  asyncHandler(issueBenefits)
);
router.post(
  "/contracts/:id/benefits/:benefitKey/redeem",
  requirePermissions("customer:update"),
  asyncHandler(redeemBenefit)
);

export default router;
