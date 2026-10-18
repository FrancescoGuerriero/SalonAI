import AiInferenceLog from "./AiInferenceLog.js";
import {
  buildAiTenantFilter,
} from "./aiTenantScope.js";
import {
  NO_SHOW_INFERENCE_CAPABILITY,
} from "./noShowInferenceLedgerService.js";
import {
  buildNoShowModelEvaluation,
  clampNoShowEvaluationPeriodDays,
} from "./noShowEvaluationService.js";

const MAX_ROWS = 20000;

export async function getTenantScopedNoShowModelEvaluation({
  periodDays,
  now = new Date(),
  businessId,
  locationId = null,
  locationAccessMode = "selected",
  allowedLocationIds = [],
} = {}) {
  const {
    scope,
    filter: tenantFilter,
  } = buildAiTenantFilter({
    businessId,
    locationId,
    locationAccessMode,
    allowedLocationIds,
  });
  const days = clampNoShowEvaluationPeriodDays(periodDays);
  const to = new Date(now);
  const currentFrom = new Date(
    to.getTime() - days * 86400000
  );
  const referenceFrom = new Date(
    currentFrom.getTime() - days * 86400000
  );

  const rows = await AiInferenceLog.find({
    ...tenantFilter,
    capability: NO_SHOW_INFERENCE_CAPABILITY,
    "outcome.evaluationEligible": true,
    outcomeObservedAt: {
      $gte: referenceFrom,
      $lte: to,
    },
  })
    .select(
      "modelName modelVersion prediction.probability prediction.riskLevel outcome.noShowLabel outcomeObservedAt"
    )
    .sort({ outcomeObservedAt: -1 })
    .limit(MAX_ROWS)
    .lean();

  const groups = new Map();

  for (const row of rows) {
    const modelName = String(row.modelName || "");
    const modelVersion = String(row.modelVersion || "");
    const key = `${modelName}::${modelVersion}`;

    if (!groups.has(key)) {
      groups.set(key, {
        modelName,
        modelVersion,
        current: [],
        reference: [],
      });
    }

    const observedAt = new Date(row.outcomeObservedAt);
    groups.get(key)[
      observedAt >= currentFrom
        ? "current"
        : "reference"
    ].push(row);
  }

  const models = Array.from(groups.values())
    .map((group) => buildNoShowModelEvaluation(group))
    .sort(
      (a, b) =>
        b.calibration.sampleCount -
        a.calibration.sampleCount
    );

  return {
    capability: NO_SHOW_INFERENCE_CAPABILITY,
    period: {
      days,
      currentFrom: currentFrom.toISOString(),
      referenceFrom: referenceFrom.toISOString(),
      to: to.toISOString(),
    },
    rowsRead: rows.length,
    truncated: rows.length >= MAX_ROWS,
    models,
    scope: {
      tenantScoped: true,
      businessId: scope.businessId,
      locationId: scope.locationId,
      locationAccessMode: scope.locationAccessMode,
      authorisedLocationCount:
        scope.locationAccessMode === "all"
          ? null
          : scope.allowedLocationIds.length,
    },
    governance: {
      aggregateOnly: true,
      containsCustomerIdentifiers: false,
      automaticTraining: false,
      automaticPromotion: false,
      automaticActivation: false,
      thresholdsAreInternalHeuristics: true,
    },
  };
}

export default {
  getTenantScopedNoShowModelEvaluation,
};
