import mongoose from "mongoose";

import ConnectorHealth from "../../models/ConnectorHealth.js";
import {
  buildAiGovernanceLearningOverview,
} from "../aiPlatform/aiGovernanceLearningService.js";

function observabilityError(message, code = "OBSERVABILITY_SCOPE_REQUIRED") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function trustedId(value) {
  const text = String(value || "").trim();
  return mongoose.isValidObjectId(text) ? text : "";
}

function projectConnector(item) {
  return {
    id: String(item._id),
    componentKey: item.componentKey,
    status: item.status,
    lastSuccessAt: item.lastSuccessAt || null,
    lastFailureAt: item.lastFailureAt || null,
    latencyMs: Number.isFinite(item.latencyMs) ? item.latencyMs : null,
    retryAt: item.retryAt || null,
    tokenExpiresAt: item.tokenExpiresAt || null,
    hasError: Boolean(item.lastError),
    updatedAt: item.updatedAt || null,
  };
}

export async function buildSystemObservabilityOverview({
  businessId,
  verticalId = "",
} = {}) {
  const trustedBusinessId = trustedId(businessId);
  if (!trustedBusinessId) {
    throw observabilityError("Trusted Business authority is required for observability.");
  }

  const connectors = await ConnectorHealth.find({
    business: trustedBusinessId,
  })
    .select(
      "componentKey status lastSuccessAt lastFailureAt latencyMs retryAt tokenExpiresAt lastError updatedAt"
    )
    .sort({ status: 1, componentKey: 1 })
    .lean();

  const connectorViews = connectors.map(projectConnector);
  const ai = await buildAiGovernanceLearningOverview({
    businessId: trustedBusinessId,
    verticalId,
  });

  const connectorSummary = {
    total: connectorViews.length,
    healthy: connectorViews.filter(({ status }) => status === "healthy").length,
    degraded: connectorViews.filter(({ status }) => status === "degraded").length,
    error: connectorViews.filter(({ status }) => status === "error").length,
    disconnected: connectorViews.filter(({ status }) => status === "disconnected").length,
    unknown: connectorViews.filter(({ status }) => status === "unknown").length,
  };

  return {
    businessId: trustedBusinessId,
    verticalId: String(verticalId || "").trim().toLowerCase(),
    generatedAt: new Date().toISOString(),
    connectors: connectorViews,
    connectorSummary,
    ai: {
      datasetCount: ai.summary.datasetCount,
      frozenDatasetCount: ai.summary.frozenDatasetCount,
      candidateModelCount: ai.summary.candidateModelCount,
      approvedModelCount: ai.summary.approvedModelCount,
      productionModelCount: ai.summary.productionModelCount,
      productionTrainingEnabled: ai.policy.productionTrainingEnabled,
      automaticPromotionEnabled: ai.policy.automaticPromotionEnabled,
      automaticInferenceActivationEnabled:
        ai.policy.automaticInferenceActivationEnabled,
    },
    backgroundJobs: {
      state: "scope-unavailable",
      tenantScopedEvidenceAvailable: false,
      reason:
        "No canonical tenant-scoped background-job health registry is available yet; this console will not infer worker state from process assumptions.",
    },
    deadLetters: {
      state: "scope-unavailable",
      tenantScopedEvidenceAvailable: false,
      exposedRecordCount: 0,
      reason:
        "DeadLetterRecord does not currently carry Business/Location ownership, so tenant observability must not expose raw dead-letter records.",
    },
    policy: {
      readOnly: true,
      secretsVisible: false,
      operationalWritesEnabled: false,
      crossTenantTelemetryEnabled: false,
    },
  };
}

export default buildSystemObservabilityOverview;
