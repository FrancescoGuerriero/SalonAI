import express from "express";
import asyncHandler from "../../shared/asyncHandler.js";
import { protect } from "../../middleware/authMiddleware.js";
import { trustedTenantContextMiddleware } from "../../platform/tenancy/trustedTenantMiddleware.js";
import { effectiveAuthorityMiddleware } from "../../middleware/effectiveAuthorityMiddleware.js";
import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import * as service from "./marketingEditorialService.js";

const router = express.Router();
router.use(protect, trustedTenantContextMiddleware, effectiveAuthorityMiddleware);

function actor(request) { return request.effectiveAuthority.userId; }
function scope(request) { return request.effectiveAuthority; }

router.get("/editorial-placements", requirePermissions("customer-experience:read"), asyncHandler(async (request, response) => {
  response.json({ success: true, items: await service.listEditorialPlacements(scope(request), request.query) });
}));
router.post("/editorial-placements", requirePermissions("customer-experience:manage"), asyncHandler(async (request, response) => {
  response.status(201).json({ success: true, item: await service.createEditorialPlacement(request.body || {}, scope(request), actor(request)) });
}));
router.post("/editorial-placements/:id/transition", requirePermissions("customer-experience:manage"), asyncHandler(async (request, response) => {
  response.json({ success: true, item: await service.transitionEditorialPlacement(request.params.id, request.body || {}, scope(request), actor(request)) });
}));
router.get("/backlinks", requirePermissions("reports:read"), asyncHandler(async (request, response) => {
  response.json({ success: true, items: await service.listBacklinkObservations(scope(request), request.query) });
}));
router.post("/backlinks/manual", requirePermissions("reports:manage"), asyncHandler(async (request, response) => {
  response.status(201).json({ success: true, item: await service.recordManualBacklink(request.body || {}, scope(request), actor(request)) });
}));
router.get("/backlinks/monthly", requirePermissions("reports:read"), asyncHandler(async (request, response) => {
  response.json({ success: true, report: await service.monthlyBacklinkSummary(scope(request), request.query.month) });
}));

export default router;
