import mongoose from "mongoose";

import AiKnowledgeDocument from "./AiKnowledgeDocument.js";
import AiModelVersion from "./AiModelVersion.js";
import AiTrainingDataset from "./AiTrainingDataset.js";
import {
  listAiEvaluationSuites,
} from "./aiEvaluationSuiteRegistry.js";
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

function knowledgeProjection(document) {
  return {
    id: String(document._id),
    title: document.title,
    sourceType: document.sourceType,
    sourceKey: document.sourceKey,
    version: document.version,
    scopeMode: document.knowledgeScope?.mode || null,
    verticals: document.knowledgeScope?.verticals || [],
    tenantBlueprintKey: document.knowledgeScope?.tenantBlueprintKey || "",
    profileKeys: document.knowledgeScope?.profileKeys || [],
    crossTenantUseApproved:
      document.knowledgeScope?.crossTenantUseApproved === true,
    retrievalStrategy: document.retrieval?.strategy || "lexical",
    vectorIndexed: Boolean(document.retrieval?.vectorReference),
    reviewedAt: document.provenance?.reviewedAt || null,
    sourceHash: document.provenance?.sourceHash || "",
    updatedAt: document.updatedAt || null,
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

  const cleanVerticalId = String(verticalId || "").trim().toLowerCase();
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

  const knowledgeScope = {
    status: "published",
    "provenance.reviewedAt": { $ne: null },
    $or: [
      {
        "knowledgeScope.mode": "tenant",
        "knowledgeScope.business": trustedBusinessId,
      },
      ...(cleanVerticalId
        ? [
            {
              "knowledgeScope.mode": "vertical",
              "knowledgeScope.verticals": cleanVerticalId,
              "knowledgeScope.crossTenantUseApproved": true,
              "knowledgeScope.governanceBasis": { $nin: ["", null] },
            },
          ]
        : []),
      {
        "knowledgeScope.mode": "platform_global",
        "knowledgeScope.crossTenantUseApproved": true,
        "knowledgeScope.governanceBasis": { $nin: ["", null] },
      },
    ],
  };

  const [datasets, knowledgeDocuments] = await Promise.all([
    AiTrainingDataset.find(datasetScope)
      .sort({ updatedAt: -1 })
      .lean(),
    AiKnowledgeDocument.find(knowledgeScope)
      .select(
        "_id title sourceType sourceKey version knowledgeScope retrieval provenance updatedAt"
      )
      .sort({ updatedAt: -1 })
      .lean(),
  ]);
  const datasetIds = datasets.map((dataset) => dataset._id);

  const models = datasetIds.length
    ? await AiModelVersion.find({ trainingDataset: { $in: datasetIds } })
        .populate("trainingDataset", "name version task scope trainingContext")
        .sort({ updatedAt: -1 })
        .lean()
    : [];

  const profiles = listAiTrainingProfiles().filter(
    (profile) => !cleanVerticalId || profile.verticalId === cleanVerticalId
  );
  const evaluationSuites = listAiEvaluationSuites();

  const datasetViews = datasets.map(datasetProjection);
  const modelViews = models.map(modelProjection);
  const knowledgeViews = knowledgeDocuments.map(knowledgeProjection);

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
    verticalId: cleanVerticalId,
    policy: {
      productionTrainingEnabled: false,
      automaticPromotionEnabled: false,
      automaticInferenceActivationEnabled: false,
      humanControlledPromotionRequired: true,
      unscopedModelsVisible: false,
      unscopedKnowledgeVisible: false,
      retrievedKnowledgeMayAuthorizeMutation: false,
    },
    layers: layerSummaries,
    profiles,
    datasets: datasetViews,
    models: modelViews,
    knowledge: knowledgeViews,
    evaluationSuites,
    summary: {
      datasetCount: datasetViews.length,
      frozenDatasetCount: datasetViews.filter(({ status }) => status === "frozen").length,
      candidateModelCount: modelViews.filter(({ lifecycle }) => lifecycle === "candidate").length,
      approvedModelCount: modelViews.filter(({ lifecycle }) => lifecycle === "approved").length,
      productionModelCount: modelViews.filter(({ lifecycle }) => lifecycle === "production").length,
      knowledgeDocumentCount: knowledgeViews.length,
      tenantKnowledgeCount: knowledgeViews.filter(({ scopeMode }) => scopeMode === "tenant").length,
      verticalKnowledgeCount: knowledgeViews.filter(({ scopeMode }) => scopeMode === "vertical").length,
      globalKnowledgeCount: knowledgeViews.filter(({ scopeMode }) => scopeMode === "platform_global").length,
      vectorIndexedKnowledgeCount: knowledgeViews.filter(({ vectorIndexed }) => vectorIndexed).length,
      evaluationSuiteCount: evaluationSuites.length,
    },
  };
}

export default buildAiGovernanceLearningOverview;
