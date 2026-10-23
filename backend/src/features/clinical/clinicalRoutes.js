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
import {
  requireClinicalEligibility,
  requireClinicalProfileLocation,
} from "./clinicalEligibilityMiddleware.js";
import * as controller from "./clinicalController.js";

const router = Router();

router.use(trustedTenantContextMiddleware);
router.use(effectiveAuthorityMiddleware);

/* Eligibility administration is the only clinical surface available before
 * eligibility has been granted. The pack otherwise fails closed by default. */
router.get(
  "/eligibility",
  requirePermissions("clinical:eligibility:manage"),
  asyncHandler(controller.eligibility)
);
router.put(
  "/eligibility/:regionKey",
  requirePermissions("clinical:eligibility:manage"),
  asyncHandler(controller.configureEligibility)
);

router.use(asyncHandler(requireClinicalEligibility));
router.param(
  "profileId",
  asyncHandler(requireClinicalProfileLocation)
);

router.get(
  "/profiles",
  requirePermissions("clinical:record:read"),
  asyncHandler(controller.profiles)
);
router.post(
  "/profiles",
  requirePermissions("clinical:record:write"),
  asyncHandler(controller.createProfile)
);
router.get(
  "/profiles/:profileId",
  requirePermissions("clinical:record:read"),
  asyncHandler(controller.profile)
);

router.get(
  "/profiles/:profileId/consents",
  requirePermissions("clinical:consent:read"),
  asyncHandler(controller.consents)
);
router.post(
  "/profiles/:profileId/consents",
  requirePermissions("clinical:consent:manage"),
  asyncHandler(controller.recordConsent)
);

router.post(
  "/profiles/:profileId/intakes",
  requirePermissions("clinical:record:write"),
  asyncHandler(controller.createIntake)
);
router.patch(
  "/intakes/:intakeId",
  requirePermissions("clinical:record:write"),
  asyncHandler(controller.updateIntake)
);
router.post(
  "/intakes/:intakeId/submit",
  requirePermissions("clinical:record:write"),
  asyncHandler(controller.submitIntake)
);
router.post(
  "/intakes/:intakeId/review",
  requirePermissions("clinical:record:write"),
  asyncHandler(controller.reviewIntake)
);

router.get(
  "/credentials",
  requirePermissions("clinical:credential:read"),
  asyncHandler(controller.credentials)
);
router.post(
  "/credentials",
  requirePermissions("clinical:credential:manage"),
  asyncHandler(controller.createCredential)
);
router.post(
  "/credentials/:credentialId/verify",
  requirePermissions("clinical:credential:manage"),
  asyncHandler(controller.verifyCredential)
);

router.post(
  "/profiles/:profileId/treatments",
  requirePermissions("clinical:record:write"),
  asyncHandler(controller.createTreatment)
);
router.get(
  "/treatments/:recordId",
  requirePermissions("clinical:record:read"),
  asyncHandler(controller.treatment)
);
router.patch(
  "/treatments/:recordId",
  requirePermissions("clinical:record:write"),
  asyncHandler(controller.updateTreatment)
);
router.post(
  "/treatments/:recordId/sign",
  requirePermissions("clinical:record:sign"),
  asyncHandler(controller.signTreatment)
);

router.post(
  "/profiles/:profileId/media",
  requirePermissions("clinical:media:manage"),
  asyncHandler(controller.registerMedia)
);
router.get(
  "/media/:mediaId",
  requirePermissions("clinical:media:read"),
  asyncHandler(controller.media)
);
router.post(
  "/media/:mediaId/dispose",
  requirePermissions("clinical:media:manage"),
  asyncHandler(controller.disposeMedia)
);

router.post(
  "/profiles/:profileId/prescription-references",
  requirePermissions("clinical:record:write"),
  asyncHandler(controller.createPrescriptionReference)
);

router.get(
  "/access-logs",
  requirePermissions("clinical:record:read"),
  asyncHandler(controller.accessLogs)
);

export default router;
