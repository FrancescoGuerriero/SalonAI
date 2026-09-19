import express from "express";

import {
  protect,
} from "../../middleware/authMiddleware.js";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";

import {
  analyseCustomerSegmentation,
} from "./aiCustomerSegmentationController.js";

import {
  generateAppointmentDemandForecast,
} from "./aiDemandForecastingController.js";

import {
  recommendHaircare,
  status,
} from "./aiRecommendationController.js";

import {
  generateCustomerSummary,
} from "./aiCustomerSummaryController.js";

import {
  generateAiSalesForecast,
} from "./aiSalesForecastingController.js";

import {
  generateAiMarketingInsights,
} from "./aiMarketingInsightsController.js";
import {
  getAiManagementCopilot,
} from "./aiManagementCopilotController.js";
import {
  askAdviser,
} from "./aiAdviserController.js";
import {
  submitFeedback,
} from "./aiAdviserFeedbackController.js";
import {
  getEvaluation,
} from "./aiAdviserEvaluationController.js";
import {
  createProposal,
  listProposals,
  reviewProposal,
} from "./aiAdviserProposalController.js";
import {
  prepareProposalDraft,
} from "./aiAdviserProposalPreparationController.js";

const router = express.Router();


/*
|--------------------------------------------------------------------------
| Authentication and authorisation
|--------------------------------------------------------------------------
|
| Every route in this router contains operational or AI-generated management
| information. Authentication plus the delegated ai:use capability is required.
| This keeps custom staff roles permission-driven rather than tied to a legacy
| hard-coded role name.
|
*/

router.use(protect);
router.use(
  requirePermissions(
    "ai:use"
  )
);


/*
|--------------------------------------------------------------------------
| AI-service status
|--------------------------------------------------------------------------
*/

router.get(
  "/status",
  asyncHandler(status)
);


/*
|--------------------------------------------------------------------------
| SalonAI Adviser / management copilot
|--------------------------------------------------------------------------
*/

router.post(
  "/adviser/query",
  requirePermissions(
    "ai:use"
  ),
  asyncHandler(
    askAdviser
  )
);

router.patch(
  "/adviser/inferences/:inferenceId/feedback",
  requirePermissions(
    "ai:use"
  ),
  asyncHandler(
    submitFeedback
  )
);

router.get(
  "/adviser/evaluation",
  requirePermissions(
    "ai:use"
  ),
  asyncHandler(
    getEvaluation
  )
);

router.get(
  "/adviser/proposals",
  requirePermissions(
    "ai:use"
  ),
  asyncHandler(
    listProposals
  )
);

router.post(
  "/adviser/proposals",
  requirePermissions(
    "ai:use"
  ),
  asyncHandler(
    createProposal
  )
);

router.patch(
  "/adviser/proposals/:proposalId/review",
  requirePermissions(
    "ai:use"
  ),
  asyncHandler(
    reviewProposal
  )
);

router.post(
  "/adviser/proposals/:proposalId/prepare",
  requirePermissions(
    "ai:use"
  ),
  asyncHandler(
    prepareProposalDraft
  )
);

router.get(
  "/management-copilot",
  requirePermissions(
    "ai:use"
  ),
  asyncHandler(
    getAiManagementCopilot
  )
);


/*
|--------------------------------------------------------------------------
| Haircare recommendations
|--------------------------------------------------------------------------
*/

router.post(
  "/haircare/recommendations",
  asyncHandler(
    recommendHaircare
  )
);


/*
|--------------------------------------------------------------------------
| Customer AI summaries
|--------------------------------------------------------------------------
*/

router.get(
  "/customers/:customerId/summary",
  asyncHandler(
    generateCustomerSummary
  )
);


/*
|--------------------------------------------------------------------------
| AI customer segmentation
|--------------------------------------------------------------------------
*/

router.get(
  "/customer-segmentation",
  asyncHandler(
    analyseCustomerSegmentation
  )
);


/*
|--------------------------------------------------------------------------
| AI appointment-demand forecasting
|--------------------------------------------------------------------------
|
| Examples:
|
| GET /api/ai/appointment-demand-forecast
| GET /api/ai/appointment-demand-forecast?horizonDays=28
| GET /api/ai/appointment-demand-forecast?lookbackDays=180&horizonDays=28
|
*/

router.get(
  "/appointment-demand-forecast",
  asyncHandler(
    generateAppointmentDemandForecast
  )
);


/*
|--------------------------------------------------------------------------
| AI sales forecasting
|--------------------------------------------------------------------------
|
| Examples:
|
| GET /api/ai/sales-forecast
| GET /api/ai/sales-forecast?horizonDays=90
| GET /api/ai/sales-forecast?lookbackDays=365&horizonDays=90
| GET /api/ai/sales-forecast?scenarioAdjustment=0.1
|
*/

router.get(
  "/sales-forecast",
  asyncHandler(
    generateAiSalesForecast
  )
);

router.get(
  "/marketing-insights",
  asyncHandler(
    generateAiMarketingInsights
  )
);

export default router;