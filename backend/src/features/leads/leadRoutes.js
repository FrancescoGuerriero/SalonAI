import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import * as controller from "./leadController.js";

const router = express.Router();

router.get(
  "/",
  requirePermissions("customer:read"),
  asyncHandler(controller.leads)
);
router.post(
  "/",
  requirePermissions("customer:update"),
  asyncHandler(controller.capture)
);
router.get(
  "/:leadId/attribution",
  requirePermissions("customer:read"),
  asyncHandler(controller.attribution)
);
router.post(
  "/:leadId/attribution",
  requirePermissions("customer:update"),
  asyncHandler(controller.addAttribution)
);
router.get(
  "/:leadId",
  requirePermissions("customer:read"),
  asyncHandler(controller.lead)
);
router.patch(
  "/:leadId",
  requirePermissions("customer:update"),
  asyncHandler(controller.update)
);
router.post(
  "/:leadId/timeline",
  requirePermissions("customer:update"),
  asyncHandler(controller.timeline)
);
router.post(
  "/:leadId/score",
  requirePermissions("customer:update"),
  asyncHandler(controller.score)
);
router.post(
  "/:leadId/nurture",
  requirePermissions("communications:manage"),
  asyncHandler(controller.nurture)
);
router.post(
  "/:leadId/convert",
  requirePermissions("customer:create"),
  asyncHandler(controller.convert)
);
router.post(
  "/:leadId/opportunities",
  requirePermissions("customer:update"),
  asyncHandler(controller.addOpportunity)
);
router.patch(
  "/:leadId/opportunities/:opportunityId",
  requirePermissions("customer:update"),
  asyncHandler(controller.editOpportunity)
);

export default router;
