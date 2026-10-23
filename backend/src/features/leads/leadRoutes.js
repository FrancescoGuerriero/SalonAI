import express from "express";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import * as controller from "./leadController.js";
import * as attributionController from "./growthAttributionController.js";

const router = express.Router();

router.get(
  "/attribution/summary",
  requirePermissions("reports:read"),
  asyncHandler(attributionController.summary)
);
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
router.get(
  "/:leadId/attribution",
  requirePermissions("reports:read"),
  asyncHandler(attributionController.leadAttribution)
);
router.post(
  "/:leadId/attribution/reconcile",
  requirePermissions("customer:update"),
  asyncHandler(attributionController.reconcile)
);
router.post(
  "/:leadId/attribution/appointments/:appointmentId",
  requirePermissions("customer:update"),
  asyncHandler(attributionController.linkAppointment)
);

export default router;
