import express from "express";

import {
  protect,
} from "../../middleware/authMiddleware.js";

import asyncHandler from "../../shared/asyncHandler.js";
import {
  effectiveAuthorityMiddleware,
} from "../../middleware/effectiveAuthorityMiddleware.js";
import {
  requirePermissions,
} from "../../middleware/permissionMiddleware.js";
import {
  trustedTenantContextMiddleware,
} from "../../platform/tenancy/trustedTenantMiddleware.js";
import { requireCommercialModule } from "../../middleware/commercialModuleEntitlementMiddleware.js";

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
  getAiNoShowPredictions,
} from "./aiNoShowPredictionController.js";
import {
  getAiNoShowEvaluation,
} from "./aiNoShowEvaluationController.js";
import {
  getAiManagementCopilot,
} from "./aiManagementCopilotController.js";
import {
  getAiStylistCopilot,
} from "./aiStylistCopilotController.js";
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
import {
  leadPilot,
  measurePilot,
  retentionPilot,
} from "./aiGrowthPilotController.js";
import {
  observeOutcome as observeWorkforceOutcome,
  outcomes as workforceOutcomes,
  proposals as workforceProposals,
  registry as workforceRegistry,
  runs as workforceRuns,
} from "./aiWorkforceGovernanceController.js";

const router = express.Router();

router.use(protect);
router.use(
  requirePermissions(
    "ai:use"
  )
);

const tenantAwareAiChain = [
  trustedTenantContextMiddleware,
  effectiveAuthorityMiddleware,
  requirePermissions(
    "ai:use"
  ),
];

const adviserModuleChain = [
  ...tenantAwareAiChain,
  requireCommercialModule("ai-decision-support"),
];

const stylistModuleChain = [
  ...tenantAwareAiChain,
  requireCommercialModule("ai-stylist-copilot"),
];

router.get(
  "/status",
  asyncHandler(status)
);

router.post(
  "/adviser/query",
  ...adviserModuleChain,
  asyncHandler(askAdviser)
);

router.patch(
  "/adviser/inferences/:inferenceId/feedback",
  ...adviserModuleChain,
  asyncHandler(submitFeedback)
);

router.get(
  "/adviser/evaluation",
  ...adviserModuleChain,
  asyncHandler(getEvaluation)
);

router.get(
  "/adviser/proposals",
  ...adviserModuleChain,
  asyncHandler(listProposals)
);

router.post(
  "/adviser/proposals",
  ...adviserModuleChain,
  asyncHandler(createProposal)
);

router.patch(
  "/adviser/proposals/:proposalId/review",
  ...adviserModuleChain,
  asyncHandler(reviewProposal)
);

router.post(
  "/adviser/proposals/:proposalId/prepare",
  ...adviserModuleChain,
  asyncHandler(prepareProposalDraft)
);

router.get(
  "/workforce/registry",
  ...tenantAwareAiChain,
  asyncHandler(workforceRegistry)
);

router.get(
  "/workforce/runs",
  ...tenantAwareAiChain,
  asyncHandler(workforceRuns)
);

router.get(
  "/workforce/proposals",
  ...tenantAwareAiChain,
  asyncHandler(workforceProposals)
);

router.get(
  "/workforce/outcomes",
  ...tenantAwareAiChain,
  asyncHandler(workforceOutcomes)
);

router.post(
  "/workforce/pilots/retention",
  ...tenantAwareAiChain,
  asyncHandler(retentionPilot)
);

router.post(
  "/workforce/pilots/leads/:leadId",
  ...tenantAwareAiChain,
  asyncHandler(leadPilot)
);

router.post(
  "/workforce/pilots/proposals/:proposalId/measure",
  ...tenantAwareAiChain,
  asyncHandler(measurePilot)
);

router.post(
  "/workforce/proposals/:proposalId/outcomes",
  ...tenantAwareAiChain,
  asyncHandler(observeWorkforceOutcome)
);

router.get(
  "/management-copilot",
  ...adviserModuleChain,
  asyncHandler(getAiManagementCopilot)
);

router.get(
  "/stylist-copilot/appointments/:appointmentId",
  ...stylistModuleChain,
  asyncHandler(getAiStylistCopilot)
);

router.get(
  "/no-show-predictions",
  ...tenantAwareAiChain,
  asyncHandler(getAiNoShowPredictions)
);

router.get(
  "/no-show-evaluation",
  ...tenantAwareAiChain,
  asyncHandler(getAiNoShowEvaluation)
);

router.post(
  "/haircare/recommendations",
  asyncHandler(recommendHaircare)
);

router.get(
  "/customers/:customerId/summary",
  asyncHandler(generateCustomerSummary)
);

router.get(
  "/customer-segmentation",
  asyncHandler(analyseCustomerSegmentation)
);

router.get(
  "/appointment-demand-forecast",
  asyncHandler(generateAppointmentDemandForecast)
);

router.get(
  "/sales-forecast",
  asyncHandler(generateAiSalesForecast)
);

router.get(
  "/marketing-insights",
  asyncHandler(generateAiMarketingInsights)
);

export default router;
