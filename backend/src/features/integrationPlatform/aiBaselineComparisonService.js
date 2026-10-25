import { createHash } from "node:crypto";

import AiAdvisoryCandidateEvaluation from "../../models/AiAdvisoryCandidateEvaluation.js";
import AiBaselineComparisonEvidence from "../../models/AiBaselineComparisonEvidence.js";
import { createServiceError } from "../../shared/serviceError.js";

const SHA256_RE = /^[0-9a-f]{64}$/;
const EPSILON = 1e-9;

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function actorId(actor) {
  return actor?._id || actor?.id || null;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function delta(metric, direction, baselineValue, candidateValue) {
  const baseline = numeric(baselineValue);
  const candidate = numeric(candidateValue);
  const rawDelta = candidate - baseline;
  let nonDegraded = false;
  if (direction === "higher_or_equal") nonDegraded = candidate + EPSILON >= baseline;
  if (direction === "lower_or_equal") nonDegraded = candidate - EPSILON <= baseline;
  if (direction === "equal") nonDegraded = Math.abs(rawDelta) <= EPSILON;
  return {
    metric,
    direction,
    baselineValue: baseline,
    candidateValue: candidate,
    delta: Number(rawDelta.toFixed(9)),
    nonDegraded,
  };
}

function metricDeltas(baseline = {}, candidate = {}) {
  return [
    delta("citationIntegrityRate", "higher_or_equal", baseline.citationIntegrityRate, candidate.citationIntegrityRate),
    delta("factualGroundingRate", "higher_or_equal", baseline.factualGroundingRate, candidate.factualGroundingRate),
    delta("unsupportedClaimRate", "lower_or_equal", baseline.unsupportedClaimRate, candidate.unsupportedClaimRate),
    delta("provenanceValidityRate", "higher_or_equal", baseline.provenanceValidityRate, candidate.provenanceValidityRate),
    delta("provenanceCoverageRate", "higher_or_equal", baseline.provenanceCoverageRate, candidate.provenanceCoverageRate),
  ];
}

export async function createBaselineComparison(payload = {}, { businessId, locationId, actor = null } = {}) {
  const candidateEvaluationId = text(payload.candidateEvaluationId, 80);
  if (!candidateEvaluationId) {
    throw createServiceError("candidateEvaluationId is required.", 400, {
      code: "AI_BASELINE_COMPARISON_CANDIDATE_REQUIRED",
    });
  }

  const candidate = await AiAdvisoryCandidateEvaluation.findOne({
    _id: candidateEvaluationId,
    business: businessId,
    location: locationId,
  }).lean();

  if (!candidate) {
    throw createServiceError("Candidate evaluation was not found for the selected location.", 404, {
      code: "AI_BASELINE_COMPARISON_CANDIDATE_NOT_FOUND",
    });
  }
  if (!["shadow_model", "offline_model"].includes(candidate.candidateKind)) {
    throw createServiceError("Only shadow/offline model evaluations can be compared against the deterministic baseline.", 409, {
      code: "AI_BASELINE_COMPARISON_KIND_INVALID",
    });
  }
  const artifactSha256 = text(candidate.model?.artifactSha256, 64).toLowerCase();
  if (!SHA256_RE.test(artifactSha256)) {
    throw createServiceError("Candidate evaluation is missing a governed artifact checksum.", 409, {
      code: "AI_BASELINE_COMPARISON_ARTIFACT_REQUIRED",
    });
  }

  const baseline = await AiAdvisoryCandidateEvaluation.findOne({
    business: businessId,
    location: locationId,
    toolKey: candidate.toolKey,
    evidenceId: candidate.evidenceId,
    candidateKind: "deterministic_baseline",
    candidateVersion: candidate.baselineVersion,
    qualityGatePassed: true,
  }).sort({ createdAt: -1, _id: -1 }).lean();

  if (!baseline) {
    throw createServiceError("A matching deterministic baseline evaluation is required for the same location and evidence case.", 409, {
      code: "AI_BASELINE_COMPARISON_BASELINE_REQUIRED",
    });
  }

  const deltas = metricDeltas(baseline.metrics, candidate.metrics);
  const identityNonDegraded = candidate.metrics?.identityMatch === true && baseline.metrics?.identityMatch === true;
  const safetyNonDegraded = candidate.metrics?.safetyCompliance === true && baseline.metrics?.safetyCompliance === true;
  const reproducibilityNonDegraded = candidate.metrics?.reproducible === true && baseline.metrics?.reproducible === true;
  const allMetricsNonDegraded = deltas.every((item) => item.nonDegraded)
    && identityNonDegraded
    && safetyNonDegraded
    && reproducibilityNonDegraded;
  const manifestBaselineAssertion = candidate.baselineComparisonPassed === true;
  const baselineComparisonPassed = manifestBaselineAssertion && allMetricsNonDegraded;
  const blockers = [];
  if (!manifestBaselineAssertion) blockers.push("ARTIFACT_MANIFEST_BASELINE_ASSERTION_FAILED");
  for (const item of deltas) {
    if (!item.nonDegraded) blockers.push(`BASELINE_DEGRADATION_${item.metric}`);
  }
  if (!identityNonDegraded) blockers.push("BASELINE_IDENTITY_NON_DEGRADATION_FAILED");
  if (!safetyNonDegraded) blockers.push("BASELINE_SAFETY_NON_DEGRADATION_FAILED");
  if (!reproducibilityNonDegraded) blockers.push("BASELINE_REPRODUCIBILITY_NON_DEGRADATION_FAILED");

  const comparisonMaterial = {
    businessId: String(businessId),
    locationId: String(locationId),
    candidateEvaluationId: String(candidate._id),
    baselineEvaluationId: String(baseline._id),
    evidenceId: candidate.evidenceId,
    candidateVersion: candidate.candidateVersion,
    baselineVersion: candidate.baselineVersion,
    artifactSha256,
    manifestBaselineAssertion,
    metricDeltas: deltas,
    identityNonDegraded,
    safetyNonDegraded,
    reproducibilityNonDegraded,
    allMetricsNonDegraded,
    blockers,
  };

  const comparison = await AiBaselineComparisonEvidence.findOneAndUpdate(
    { business: businessId, location: locationId, candidateEvaluation: candidate._id },
    {
      $set: {
        baselineEvaluation: baseline._id,
        toolKey: candidate.toolKey,
        evidenceId: candidate.evidenceId,
        candidateKind: candidate.candidateKind,
        candidateVersion: candidate.candidateVersion,
        baselineVersion: candidate.baselineVersion,
        artifactSha256,
        manifestBaselineAssertion,
        metricDeltas: deltas,
        identityNonDegraded,
        safetyNonDegraded,
        reproducibilityNonDegraded,
        allMetricsNonDegraded,
        baselineComparisonPassed,
        blockers,
        comparisonHash: sha256(comparisonMaterial),
        createdBy: actorId(actor),
        productionPromotionAuthorised: false,
        productionInferenceAuthorised: false,
        deploymentAuthorised: false,
        externalWriteAuthorised: false,
      },
      $setOnInsert: {
        business: businessId,
        location: locationId,
        candidateEvaluation: candidate._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    comparison,
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
    message: baselineComparisonPassed
      ? "Candidate is non-degraded against the matching deterministic baseline for this evidence case. This evidence does not authorise promotion or production inference."
      : "Candidate baseline comparison evidence was recorded with one or more degradation blockers. Production promotion and inference remain disabled.",
  };
}

export async function listBaselineComparisons(query = {}, { businessId, locationId } = {}) {
  const match = { business: businessId, location: locationId };
  if (query.artifactSha256 && SHA256_RE.test(String(query.artifactSha256).toLowerCase())) {
    match.artifactSha256 = String(query.artifactSha256).toLowerCase();
  }
  if (["shadow_model", "offline_model"].includes(query.candidateKind)) match.candidateKind = query.candidateKind;
  if (query.baselineComparisonPassed === "true") match.baselineComparisonPassed = true;
  if (query.baselineComparisonPassed === "false") match.baselineComparisonPassed = false;
  const limit = Math.min(250, Math.max(1, Number.parseInt(query.limit, 10) || 50));
  return AiBaselineComparisonEvidence.find(match)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export async function getBaselineComparison(comparisonId, { businessId, locationId } = {}) {
  const comparison = await AiBaselineComparisonEvidence.findOne({
    _id: comparisonId,
    business: businessId,
    location: locationId,
  }).lean();
  if (!comparison) {
    throw createServiceError("Baseline comparison evidence was not found for the selected location.", 404, {
      code: "AI_BASELINE_COMPARISON_NOT_FOUND",
    });
  }
  return comparison;
}

export default { createBaselineComparison, listBaselineComparisons, getBaselineComparison };
