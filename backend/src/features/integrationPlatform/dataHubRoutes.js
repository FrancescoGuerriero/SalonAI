import express from "express";

import { requirePermissions } from "../../middleware/permissionMiddleware.js";
import asyncHandler from "../../shared/asyncHandler.js";
import * as controller from "./dataHubController.js";

const router = express.Router();
const read = requirePermissions("feature-control:read");
const write = requirePermissions("feature-control:update");
const aiUse = requirePermissions("ai:use");

router.get("/catalogue", read, asyncHandler(controller.catalogue));
router.get("/overview", read, asyncHandler(controller.overview));
router.get("/fields", read, asyncHandler(controller.fields));
router.post("/query", read, asyncHandler(controller.query));
router.post("/ai-evidence", read, asyncHandler(controller.aiEvidence));
router.post("/ai-gateway/evidence", read, asyncHandler(controller.aiGatewayEvidence));
router.post("/ai-gateway/plan", read, asyncHandler(controller.aiGatewayPlan));
router.post("/ai-gateway/advisory-preview", aiUse, asyncHandler(controller.aiGatewayAdvisoryPreview));
router.get("/ai-gateway/invocations", read, asyncHandler(controller.aiGatewayInvocations));
router.post("/ai-gateway/candidate-evaluations", aiUse, asyncHandler(controller.aiCandidateEvaluate));
router.get("/ai-gateway/candidate-evaluations", read, asyncHandler(controller.aiCandidateEvaluations));
router.get("/ai-gateway/candidate-evaluations/:recordId", read, asyncHandler(controller.aiCandidateEvaluation));
router.patch("/ai-gateway/candidate-evaluations/:recordId/review", write, asyncHandler(controller.aiCandidateReview));
router.post("/ai-gateway/offline-experiments", aiUse, asyncHandler(controller.runAiOfflineExperiment));
router.get("/ai-gateway/offline-experiments", read, asyncHandler(controller.aiOfflineExperiments));
router.get("/ai-gateway/offline-experiments/:runId", read, asyncHandler(controller.aiOfflineExperiment));
router.get("/ai-gateway/promotion-proposals", read, asyncHandler(controller.aiPromotionProposals));
router.post("/ai-gateway/promotion-proposals", write, asyncHandler(controller.createAiPromotionProposal));
router.get("/ai-gateway/promotion-proposals/:dossierId", read, asyncHandler(controller.aiPromotionProposal));
router.patch("/ai-gateway/promotion-proposals/:dossierId", write, asyncHandler(controller.updateAiPromotionProposal));

router.get("/saved-views", read, asyncHandler(controller.savedViews));
router.post("/saved-views", write, asyncHandler(controller.createSavedView));
router.patch("/saved-views/:viewId", write, asyncHandler(controller.updateSavedView));
router.post("/saved-views/:viewId/query", read, asyncHandler(controller.runSavedView));

router.get("/destinations", read, asyncHandler(controller.destinations));
router.post("/destinations", write, asyncHandler(controller.createDestination));
router.patch("/destinations/:taskId", write, asyncHandler(controller.updateDestination));
router.post("/destinations/:taskId/preview", write, asyncHandler(controller.previewDestination));
router.get("/destination-runs", read, asyncHandler(controller.destinationRuns));

export default router;
