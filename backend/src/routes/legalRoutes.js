import express from "express";

import asyncHandler from "../middleware/asyncHandler.js";
import {
  recordTrackingConsent,
} from "../controllers/trackingConsentController.js";

import {
  getMarketingComplianceReadiness,
  getPublicLegalIdentity,
} from "../config/legalComplianceConfig.js";

const router = express.Router();

router.post(
  "/tracking-consent",
  asyncHandler(
    recordTrackingConsent
  )
);

router.get(
  "/public",
  (request, response) => {
    const readiness =
      getMarketingComplianceReadiness();

    return response.json({
      success: true,
      legal:
        getPublicLegalIdentity(),
      marketingComplianceConfigured:
        readiness.ready,
    });
  }
);

export default router;
