import AiAdvisoryCandidateEvaluation from "../../models/AiAdvisoryCandidateEvaluation.js";
import AiCandidateBaselineComparison from "../../models/AiCandidateBaselineComparison.js";
import { createServiceError } from "../../shared/serviceError.js";

const HIGHER_IS_BETTER = [
  "citationIntegrityRate",
  "factualGroundingRate",
  "provenanceValidityRate",
  "provenanceCoverageRate",
];
const LOWER_IS_BETTER = ["unsupportedClaimRate"];

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function actorId(actor) {
  return actor?._id || actor?.id || null;
}

function rounded(value) {
  return Number(Number(value || 0).toFixed(6));
}

function metricDelta(candidateValue, baselineValue, higherIsBetter) {
  const candidate = rounded(candidateValue);
  const baseline = rounded(baselineValue);
  const delta = rounded(candidate - baseline);
  const equal = delta === 0;
  const better = higherIsBetter ? delta > 0 : delta < 0;
  const passed = higherIsBetter ? candidate >= baseline : candidate <= baseline;
  return {
    candidate,
    baseline,
    delta,
    direction: equal ? "equal" : better ? "better" : "worse",
    nonDegradationPassed: passed,
  };
}

function comparisonMetrics(candidate, baseline) {
  const deltas = {};
  for (const key of HIGHER_IS_BETTER) {
    deltas[key] = metricDelta(candidate?.metrics?.[key], baseline?.metrics?.[key], true);
  }
  for (const key of LOWER_IS_BETTER) {
    deltas[key] = metricDelta(candidate?.metrics?.[key], baseline?.metrics?.[key], false);
  }
  return deltas;
}

function overallDecision(metricDeltas) {
  const directions = Object.values(metricDeltas).map((item) => item.direction);
  if (directions.every((item) => item === "equal")) return "equal";
  if (directions.every((item) => item !== "worse") && directions.some((item) => item === "better")) return "better";
  if (directions.every((item) => item !== "better") && directions.some((item) => item === "worse")) return "worse";
  return "mixed";
}

async function loadPair(candidateEvaluationId, baselineEvaluationId, { businessId, locationId }) {
  const [candidate, baseline] = await Promise.all([
    AiAdvisoryCandidateEvaluation.findOne({
      _id: candidateEvaluationId,
      business: businessId,
      location: locationId,
    }),
    AiAdvisoryCandidateEvaluation.findOne({
      _id: baselineEvaluationId,
      business: businessId,
      location: locationId,
    }),
  ]);

  if (!candidate) {
    throw createServiceError("Model candidate evaluation was not found for the selected location.", 404, {
      code: "AI_BASELINE_COMPARISON_CANDIDATE_NOT_FOUND",
    });
  }
  if (!baseline) {
    throw createServiceError("Deterministic baseline evaluation was not found for the selected location.", 404, {
      code: "AI_BASELINE_COMPARISON_BASELINE_NOT_FOUND",
    });
  }
  if (!["shadow_model", "offline_model"].includes(candidate.candidateKind)) {
    throw createServiceError("Baseline comparison requires a shadow or offline model candidate.", 409, {
      code: "AI_BASELINE_COMPARISON_CANDIDATE_KIND_INVALID",
    });
  }
  if (baseline.candidateKind !== "deterministic_baseline") {
    throw createServiceError("Baseline evaluation must be the deterministic baseline.", 409, {
      code: "AI_BASELINE_COMPARISON_BASELINE_KIND_INVALID",
    });
  }
  if (
    String(candidate.evidenceId) !== String(baseline.evidenceId)
    || String(candidate.toolKey) !== String(baseline.toolKey)
    || String(candidate.requestedAction) !== String(baseline.requestedAction)
    || String(candidate.baselineVersion) !== String(baseline.baselineVersion)
    || String(candidate.policyVersion) !== String(baseline.policyVersion)
  ) {
    throw createServiceError("Candidate and baseline evaluations do not describe the same governed evidence case.", 409, {
      code: "AI_BASELINE_COMPARISON_CASE_MISMATCH",
    });
  }
  if (["accepted_for_promotion_proposal", "rejected"].includes(candidate.promotionReviewStatus)) {
    throw createServiceError("Final human-reviewed candidates cannot be re-baselined.", 409, {
      code: "AI_BASELINE_COMPARISON_REVIEW_FINAL",
    });
  }
  if (!candidate.model?.artifactSha256) {
    throw createServiceError("Candidate is missing governed artifact provenance.", 409, {
      code: "AI_BASELINE_COMPARISON_ARTIFACT_REQUIRED",
    });
  }
  return { candidate, baseline };
}

async function qualifyingEvidenceCaseCount(candidate) {
  const ids = await AiAdvisoryCandidateEvaluation.distinct("evidenceId", {
    business: candidate.business,
    location: candidate.location,
    toolKey: candidate.toolKey,
    candidateKind: candidate.candidateKind,
    candidateVersion: candidate.candidateVersion,
    "model.artifactSha256": candidate.model?.artifactSha256 || "",
    policyVersion: candidate.policyVersion,
    baselineVersion: candidate.baselineVersion,
    qualityGatePassed: true,
    baselineComparisonPassed: true,
    baselineComparisonSource: "evidence_derived",
    artifactPromotionEligible: true,
    "promotionReadiness.repeatedRunEvidenceSufficient": true,
  });
  return ids.length;
}

export async function compareCandidateToBaseline(payload = {}, { businessId, locationId, actor = null } = {}) {
  const candidateEvaluationId = text(payload.candidateEvaluationId, 80);
  const baselineEvaluationId = text(payload.baselineEvaluationId, 80);
  if (!candidateEvaluationId || !baselineEvaluationId) {
    throw createServiceError("candidateEvaluationId and baselineEvaluationId are required.", 400, {
      code: "AI_BASELINE_COMPARISON_IDS_REQUIRED",
    });
  }

  const existing = await AiCandidateBaselineComparison.findOne({
    business: businessId,
    location: locationId,
    candidateEvaluation: candidateEvaluationId,
  }).lean();
  if (existing) {
    throw createServiceError("This candidate evaluation already has an evidence-derived baseline comparison.", 409, {
      code: "AI_BASELINE_COMPARISON_ALREADY_EXISTS",
      comparisonId: existing._id,
    });
  }

  const { candidate, baseline } = await loadPair(
    candidateEvaluationId,
    baselineEvaluationId,
    { businessId, locationId }
  );
  const metricDeltas = comparisonMetrics(candidate, baseline);
  const identityNonDegradationPassed = candidate.metrics?.identityMatch === true && baseline.metrics?.identityMatch === true;
  const safetyNonDegradationPassed = candidate.metrics?.safetyCompliance === true && baseline.metrics?.safetyCompliance === true;
  const candidateRepeatedRunEvidenceSufficient = candidate.promotionReadiness?.repeatedRunEvidenceSufficient === true;
  const metricNonDegradationPassed = Object.values(metricDeltas).every((item) => item.nonDegradationPassed === true);

  const blockers = [];
  if (candidate.qualityGatePassed !== true) blockers.push("CANDIDATE_QUALITY_GATE_FAILED");
  if (baseline.qualityGatePassed !== true) blockers.push("BASELINE_QUALITY_GATE_FAILED");
  if (!identityNonDegradationPassed) blockers.push("IDENTITY_NON_DEGRADATION_FAILED");
  if (!safetyNonDegradationPassed) blockers.push("SAFETY_NON_DEGRADATION_FAILED");
  if (!metricNonDegradationPassed) blockers.push("METRIC_NON_DEGRADATION_FAILED");
  if (!candidateRepeatedRunEvidenceSufficient) blockers.push("REPEATED_RUN_EVIDENCE_INSUFFICIENT");

  const nonDegradationPassed = blockers.length === 0;
  const comparison = await AiCandidateBaselineComparison.create({
    business: businessId,
    location: locationId,
    candidateEvaluation: candidate._id,
    baselineEvaluation: baseline._id,
    toolKey: candidate.toolKey,
    requestedAction: candidate.requestedAction,
    evidenceId: candidate.evidenceId,
    candidateVersion: candidate.candidateVersion,
    baselineVersion: candidate.baselineVersion,
    model: {
      name: candidate.model?.name || "",
      version: candidate.model?.version || "",
      algorithm: candidate.model?.algorithm || "",
      artifactSha256: candidate.model?.artifactSha256,
    },
    metricDeltas,
    identityNonDegradationPassed,
    safetyNonDegradationPassed,
    candidateQualityGatePassed: candidate.qualityGatePassed === true,
    baselineQualityGatePassed: baseline.qualityGatePassed === true,
    candidateRepeatedRunEvidenceSufficient,
    nonDegradationPassed,
    overallDecision: overallDecision(metricDeltas),
    blockers,
    comparedBy: actorId(actor),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
  });

  candidate.baselineComparisonSource = "evidence_derived";
  candidate.baselineComparisonRecord = comparison._id;
  candidate.baselineComparisonPassed = nonDegradationPassed;
  candidate.artifactPromotionEligible = Boolean(
    nonDegradationPassed && candidate.model?.artifactLifecycle === "candidate"
  );
  await candidate.save();

  const qualifyingOfflineCases = candidate.artifactPromotionEligible
    ? await qualifyingEvidenceCaseCount(candidate)
    : 0;
  const requiredOfflineCases = candidate.promotionReadiness?.requiredOfflineCases || 25;
  const suiteGatePassed = qualifyingOfflineCases >= requiredOfflineCases;
  const eligibleForPromotionReview = Boolean(
    candidate.qualityGatePassed === true
    && candidate.artifactPromotionEligible === true
    && candidate.promotionReadiness?.repeatedRunEvidenceSufficient === true
    && suiteGatePassed
  );

  candidate.promotionReadiness.qualifyingOfflineCases = qualifyingOfflineCases;
  candidate.promotionReadiness.suiteGatePassed = suiteGatePassed;
  candidate.eligibleForPromotionReview = eligibleForPromotionReview;
  candidate.promotionReviewStatus = eligibleForPromotionReview ? "pending_review" : "not_eligible";
  candidate.productionPromotionAuthorised = false;
  candidate.productionInferenceAuthorised = false;
  candidate.externalWriteAuthorised = false;
  await candidate.save();

  return {
    comparison: comparison.toObject(),
    candidateEvaluation: candidate.toObject(),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
    message: nonDegradationPassed
      ? "Evidence-derived baseline non-degradation passed. Benchmark-suite and human-review gates still apply; no production action was authorised."
      : "Evidence-derived baseline comparison recorded a degradation or governance blocker. Promotion readiness remains locked.",
  };
}

export async function listBaselineComparisons(query = {}, { businessId, locationId } = {}) {
  const match = { business: businessId, location: locationId };
  if (["better", "equal", "worse", "mixed"].includes(query.overallDecision)) {
    match.overallDecision = query.overallDecision;
  }
  if (query.nonDegradationPassed === "true") match.nonDegradationPassed = true;
  if (query.nonDegradationPassed === "false") match.nonDegradationPassed = false;
  const limit = Math.min(250, Math.max(1, Number.parseInt(query.limit, 10) || 50));
  return AiCandidateBaselineComparison.find(match)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export async function getBaselineComparison(comparisonId, { businessId, locationId } = {}) {
  const comparison = await AiCandidateBaselineComparison.findOne({
    _id: comparisonId,
    business: businessId,
    location: locationId,
  }).lean();
  if (!comparison) {
    throw createServiceError("Baseline comparison was not found for the selected location.", 404, {
      code: "AI_BASELINE_COMPARISON_NOT_FOUND",
    });
  }
  return comparison;
}

export default {
  compareCandidateToBaseline,
  getBaselineComparison,
  listBaselineComparisons,
};
