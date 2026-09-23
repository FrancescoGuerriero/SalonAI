import express from "express";

import {
  getMarketingComplianceReadiness,
  getPublicLegalIdentity,
} from "../config/legalComplianceConfig.js";

const router = express.Router();

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
