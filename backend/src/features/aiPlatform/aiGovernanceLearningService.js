import mongoose from "mongoose";

import AiModelVersion from "./AiModelVersion.js";
import AiTrainingDataset from "./AiTrainingDataset.js";
import {
  AI_TRAINING_LAYERS,
  AI_TRAINING_LAYER_POLICY,
  listAiTrainingProfiles,
} from "./aiTrainingProfileRegistry.js";

function governanceError(message, code = "AI_GOVERNANCE_SCOPE_REQUIRED", statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function cleanId(value) {
  const text = String(value || "").trim();
  return mongoose.isValidObjectId(text) ? text : "";
}

function datasetProjection(dataset) {
  const readiness = dataset.quality?.readiness || {};
  return {
    id: String(dataset._id),
    name: dataset.name,
    version: dataset.version,
    task: dataset.task,
    featureVersion: dataset.featureVersion,
    status: dataset.status,
    scope: {
      mode: dataset.scope?.mode || "single_business",
      businessId: dataset.scope?.business ? String(dataset.scope.business) : null,
      locationIds: (dataset.scope?.locations || []).map(String),
      verticals: dataset.scope?.verticals || [],
      deidentified: dataset.scope?.deidentified !== false,
    },
    trainingContext: {
      layer: dataset.trainingContext?.layer || null,
      profileKey: dataset.trainingContext?.profileKey || "",
      tenantBlueprintKey: dataset.trainingContext?.tenantBlueprintKey || "",
      productionTrainingAuthorized:
        dataset.trainingContext?.productionTrainingAuthorized === true,
      automaticPromotionAuthorized:
        dataset.trainingContext?.automaticPromotionAuthorized === true,
      automaticInferenceActivationAuthorized:
        dataset.trainingContext?.automaticInferenceActivationAuthorized === true,
    },
    snapshotCount: Number(dataset.snapshotCount || 0),
    observationStart: dataset.observationStart || null,
    observationEnd: dataset.observationEnd || null,
    readiness: {
      readyToFreeze: readiness.readyToFreeze === true,
      blockers: readiness.blockers || [],
      warnings: dataset.quality?.warnings || [],
    },
    updatedAt: dataset.updatedAt || null,
  };
}

function modelProjection(model) {
  return {
    id: String(model._id),
    name: model.name,
    version: model.version,
    task: model.task,
    modelType: model.modelType,
    lifecycle: model.lifecycle,
    algorithm: model.algorithm || "",
    trainingDatasetId: model.trainingDataset?._id
      ? String(model.trainingDataset._id)
      : String(model.trainingDataset || ""),
    trainingDatasetName: model.trainingDataset?.name || "",
    metrics: model.metrics || {},
    thresholds: model.thresholds || {},
    limitations: model.limitations || [],
    approvedAt: model.approvedAt || null,
    hasHumanApproval: Boolean(model.approvedAt && model.approvedBy),
    updatedAt: model.updatedAt || null,
  };
}

export async function buildAiGovernanceLearningOverview({
  businessId,
  verticalId = "",
} = {}) {
  const trustedBusinessId = cleanId(businessId);
  if (!trustedBusinessId) {
    throw governanceError("Trusted Business authority is required for AI governance.");
  }

  const datasetScope = {
    $or: [
      { "scope.mode": "platform_global" },
      {
        "scope.mode": "cross_business_deidentified",
        "scope.deidentified": true,
      },
      {
        "scope.mode": "single_business",
        "scope.business": trustedBusinessId,
      },
    ],
  };

  const datasets = await AiTrainingDataset.find(datasetScope)
    .sort({ updatedAt: -1 })
    .lean();
  const datasetIds = datasets.map((dataset) => dataset._id);

  const models = datasetIds.length
    ? await AiModelVersion.find({ trainingDataset: { $in: datasetIds } })
        .populate("trainingDataset", "name version task scope trainingContext")
        .sort({ updatedAt: -1 })
        .lean()
    : [];

  const profiles = listAiTrainingProfiles().filter(
    (profile) => !verticalId || profile.verticalId === verticalId
  );

  const datasetViews = datasets.map(datasetProjection);
  const modelViews = models.map(modelProjection);

  const layerSummaries = AI_TRAINING_LAYERS.map((layer) => ({
    key: layer,
    policy: AI_TRAINING_LAYER_POLICY[layer],
    datasetCount: datasetViews.filter(
      (dataset) => dataset.trainingContext.layer === layer
    ).length,
    frozenDatasetCount: datasetViews.filter(
      (dataset) =>
        dataset.trainingContext.layer === layer && dataset.status === "frozen"
    ).length,
  }));

  return {
    businessId: trustedBusinessId,
    verticalId: String(verticalId || "").trim().toLowerCase(),
    policy: {
      productionTrainingEnabled: false,
      automaticPromotionEnabled: false,
      automaticInferenceActivationEnabled: false,
      humanControlledPromotionRequired: true,
      unscopedModelsVisible: false,
    },
    layers: layerSummaries,
    profiles,
    datasets: datasetViews,
    models: modelViews,
    summary: {
      datasetCount: datasetViews.length,
      frozenDatasetCount: datasetViews.filter(({ status }) => status === "frozen").length,
      candidateModelCount: modelViews.filter(({ lifecycle }) => lifecycle === "candidate").length,
      approvedModelCount: modelViews.filter(({ lifecycle }) => lifecycle === "approved").length,
      productionModelCount: modelViews.filter(({ lifecycle }) => lifecycle === "production").length,
    },
  };
}

export default buildAiGovernanceLearningOverview;
