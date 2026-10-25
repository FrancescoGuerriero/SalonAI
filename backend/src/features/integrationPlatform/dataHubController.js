import { createServiceError } from "../../shared/serviceError.js";
import * as baselineComparisonService from "./aiBaselineComparisonService.js";
import * as candidateEvaluationService from "./aiCandidateEvaluationService.js";
import * as gatewayService from "./dataHubAiGatewayService.js";
import * as offlineExperimentService from "./aiOfflineExperimentService.js";
import * as promotionProposalService from "./aiPromotionProposalService.js";
import * as service from "./dataHubService.js";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) {
    throw createServiceError("A trusted active business is required for Data Hub operations.", 400);
  }
  return value;
}

function locationId(request) {
  const value = request.effectiveAuthority?.locationId || request.tenantContext?.locationId || null;
  if (!value) {
    throw createServiceError("Select a location before using Data Hub or AI evidence.", 400, {
      code: "LOCATION_REQUIRED",
    });
  }
  return value;
}

function scope(request) {
  return { businessId: businessId(request), locationId: locationId(request) };
}

function actor(request) {
  return request.user || null;
}

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function catalogue(_request, response) {
  response.json(service.dataHubCatalogue());
}

export async function overview(request, response) {
  response.json(await service.dataHubOverview(scope(request)));
}

export async function fields(request, response) {
  response.json(await service.dataHubFieldCatalogue(scope(request)));
}

export async function query(request, response) {
  response.json(await service.queryDataHub(body(request), scope(request)));
}

export async function aiEvidence(request, response) {
  response.json(await service.buildDataHubAiEvidence(body(request), scope(request)));
}

export async function aiGatewayEvidence(request, response) {
  response.json(await gatewayService.buildGatewayEvidence(body(request), scope(request)));
}

export async function aiGatewayPlan(request, response) {
  response.json(await gatewayService.planDataHubAiGateway(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function aiGatewayAdvisoryPreview(request, response) {
  response.json(await gatewayService.previewDataHubAiAdvisory(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function aiGatewayInvocations(request, response) {
  response.json({
    items: await gatewayService.listAiGatewayInvocations(request.query || {}, scope(request)),
  });
}

export async function aiCandidateEvaluate(request, response) {
  response.status(201).json(await candidateEvaluationService.evaluateAndRecordCandidate(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function aiCandidateEvaluations(request, response) {
  response.json({
    items: await candidateEvaluationService.listCandidateEvaluations(request.query || {}, scope(request)),
  });
}

export async function aiCandidateEvaluation(request, response) {
  response.json(await candidateEvaluationService.getCandidateEvaluation(
    request.params.recordId,
    scope(request)
  ));
}

export async function aiCandidateReview(request, response) {
  response.json(await candidateEvaluationService.reviewCandidateEvaluation(
    request.params.recordId,
    body(request),
    {
      ...scope(request),
      actor: actor(request),
    }
  ));
}

export async function aiBaselineComparisons(request, response) {
  response.json({
    items: await baselineComparisonService.listBaselineComparisons(request.query || {}, scope(request)),
  });
}

export async function aiBaselineComparison(request, response) {
  response.json(await baselineComparisonService.getBaselineComparison(
    request.params.comparisonId,
    scope(request)
  ));
}

export async function createAiBaselineComparison(request, response) {
  response.status(201).json(await baselineComparisonService.compareCandidateToBaseline(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function aiOfflineExperiments(request, response) {
  response.json({
    items: await offlineExperimentService.listOfflineExperiments(request.query || {}, scope(request)),
  });
}

export async function aiOfflineExperiment(request, response) {
  response.json(await offlineExperimentService.getOfflineExperiment(
    request.params.runId,
    scope(request)
  ));
}

export async function runAiOfflineExperiment(request, response) {
  response.status(201).json(await offlineExperimentService.runOfflineExperiment(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function aiPromotionProposals(request, response) {
  response.json({
    items: await promotionProposalService.listPromotionProposals(request.query || {}, scope(request)),
  });
}

export async function aiPromotionProposal(request, response) {
  response.json(await promotionProposalService.getPromotionProposal(
    request.params.dossierId,
    scope(request)
  ));
}

export async function createAiPromotionProposal(request, response) {
  response.status(201).json(await promotionProposalService.createPromotionProposal(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function updateAiPromotionProposal(request, response) {
  response.json(await promotionProposalService.updatePromotionProposal(
    request.params.dossierId,
    body(request),
    {
      ...scope(request),
      actor: actor(request),
    }
  ));
}

export async function savedViews(request, response) {
  response.json({ items: await service.listDataHubSavedViews(request.query || {}, scope(request)) });
}

export async function createSavedView(request, response) {
  response.status(201).json(await service.createDataHubSavedView(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function updateSavedView(request, response) {
  response.json(await service.updateDataHubSavedView(request.params.viewId, body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function runSavedView(request, response) {
  response.json(await service.queryDataHubSavedView(request.params.viewId, scope(request)));
}

export async function destinations(request, response) {
  response.json({ items: await service.listDataHubDestinationTasks(request.query || {}, scope(request)) });
}

export async function createDestination(request, response) {
  response.status(201).json(await service.createDataHubDestinationTask(body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function updateDestination(request, response) {
  response.json(await service.updateDataHubDestinationTask(request.params.taskId, body(request), {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function previewDestination(request, response) {
  response.json(await service.previewDataHubDestinationTask(request.params.taskId, {
    ...scope(request),
    actor: actor(request),
  }));
}

export async function destinationRuns(request, response) {
  response.json({ items: await service.listDataHubDestinationRuns(request.query || {}, scope(request)) });
}

export default {
  aiBaselineComparison,
  aiBaselineComparisons,
  aiCandidateEvaluate,
  aiCandidateEvaluation,
  aiCandidateEvaluations,
  aiCandidateReview,
  aiEvidence,
  aiGatewayAdvisoryPreview,
  aiGatewayEvidence,
  aiGatewayInvocations,
  aiGatewayPlan,
  aiOfflineExperiment,
  aiOfflineExperiments,
  aiPromotionProposal,
  aiPromotionProposals,
  catalogue,
  createAiBaselineComparison,
  createAiPromotionProposal,
  createDestination,
  createSavedView,
  destinationRuns,
  destinations,
  fields,
  overview,
  previewDestination,
  query,
  runAiOfflineExperiment,
  runSavedView,
  savedViews,
  updateAiPromotionProposal,
  updateDestination,
  updateSavedView,
};