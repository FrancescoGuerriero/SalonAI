import express from "express";

import asyncHandler from "../../../middleware/asyncHandler.js";
import {
  protect,
} from "../../../middleware/authMiddleware.js";
import {
  effectiveAuthorityMiddleware,
} from "../../../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../../../middleware/permissionMiddleware.js";
import {
  workforcePublicTenantContextMiddleware,
} from "../../../middleware/workforceTenantMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../../platform/tenancy/trustedTenantMiddleware.js";

import {
  createJourney,
  listJourneys,
  previewJourney,
  updateJourney,
} from "./automationController.js";
import {
  createEnrollment,
  getCampaignJourneyRevenue,
  getCrmSegments,
  getCustomer360,
  getEnrollments,
  reconcileMembershipRecoveryJourneys,
  updateEnrollmentOutcome,
} from "./stage7CrmController.js";
import {
  createTechnicalRecord,
  getRetentionQueue,
  getTechnicalRecords,
} from "./stage9CrmController.js";

const router = express.Router();

router.use(
  protect,
  workforcePublicTenantContextMiddleware,
  trustedTenantContextMiddleware
);
router.use(
  requirePermissions(
    "retention-automation:manage"
  )
);

router
  .route("/journeys")
  .get(asyncHandler(listJourneys))
  .post(asyncHandler(createJourney));

router.get(
  "/journeys/:journeyId/preview",
  requirePermissions("customer:read"),
  asyncHandler(previewJourney)
);

router.patch(
  "/journeys/:journeyId",
  asyncHandler(updateJourney)
);

router.get(
  "/customers/:customerId/360",
  requirePermissions("customer:read"),
  asyncHandler(getCustomer360)
);

router.get(
  "/crm/segments",
  requirePermissions("customer:read"),
  asyncHandler(getCrmSegments)
);

router.get(
  "/crm/retention-queue",
  effectiveAuthorityMiddleware,
  requirePermissions("customer:read"),
  asyncHandler(getRetentionQueue)
);

router
  .route("/crm/customers/:customerId/technical-records")
  .get(
    effectiveAuthorityMiddleware,
    requirePermissions("customer:read"),
    asyncHandler(getTechnicalRecords)
  )
  .post(
    effectiveAuthorityMiddleware,
    requirePermissions("customer:update"),
    asyncHandler(createTechnicalRecord)
  );

router
  .route("/enrollments")
  .get(
    requirePermissions("customer:read"),
    asyncHandler(getEnrollments)
  )
  .post(asyncHandler(createEnrollment));

router.patch(
  "/enrollments/:enrollmentId/outcome",
  asyncHandler(updateEnrollmentOutcome)
);

router.post(
  "/membership-recovery/reconcile",
  asyncHandler(reconcileMembershipRecoveryJourneys)
);

router.get(
  "/measurement/campaign-revenue",
  requirePermissions("customer:read"),
  asyncHandler(getCampaignJourneyRevenue)
);

export default router;