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

async function qualifyingEvidenceCaseCount(candidate) {
  const ids = await AiAdvisoryCandidateEvaluation.distinct("evidenceId", {
    business: candidate.business,
    location: candidate.location,
    toolKey: candidate.toolKey,
    requestedAction: candidate.requestedAction,
    candidateKind: candidate.candidateKind,
    candidateVersion: candidate.candidateVersion,
    "model.artifactSha256": candidate.model?.artifactSha256 || "",
    policyVersion: candidate.policyVersion,
    baselineVersion: candidate.baselineVersion,
    qualityGatePassed: true,
    baselineComparisonPassed: true,
    baselineComparisonSource: "evidence_derived",
    baselineComparisonEvidence: { $ne: null },
    artifactPromotionEligible: true,
    "promotionReadiness.repeatedRunEvidenceSufficient": true,
  });
  return ids.length;
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
  });

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
  if (["accepted_for_promotion_proposal", "rejected"].includes(candidate.promotionReviewStatus)) {
    throw createServiceError("A final human-reviewed candidate cannot be re-baselined.", 409, {
      code: "AI_BASELINE_COMPARISON_REVIEW_FINAL",
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
    requestedAction: candidate.requestedAction,
    evidenceId: candidate.evidenceId,
    policyVersion: candidate.policyVersion,
    baselineVersion: candidate.baselineVersion,
    candidateKind: "deterministic_baseline",
    candidateVersion: candidate.baselineVersion,
    qualityGatePassed: true,
  }).sort({ createdAt: -1, _id: -1 }).lean();

  if (!baseline) {
    throw createServiceError("A matching deterministic baseline evaluation is required for the same location, action, policy and evidence case.", 409, {
      code: "AI_BASELINE_COMPARISON_BASELINE_REQUIRED",
    });
  }

  const deltas = metricDeltas(baseline.metrics, candidate.metrics);
  const identityNonDegraded = candidate.metrics?.identityMatch === true && baseline.metrics?.identityMatch === true;
  const safetyNonDegraded = candidate.metrics?.safetyCompliance === true && baseline.metrics?.safetyCompliance === true;
  const reproducibilityNonDegraded = candidate.metrics?.reproducible === true && baseline.metrics?.reproducible === true;
  const repeatedRunEvidenceSufficient = candidate.promotionReadiness?.repeatedRunEvidenceSufficient === true;
  const allMetricsNonDegraded = deltas.every((item) => item.nonDegraded)
    && identityNonDegraded
    && safetyNonDegraded
    && reproducibilityNonDegraded;
  const manifestBaselineAssertion = typeof candidate.baselineManifestAssertion === "boolean"
    ? candidate.baselineManifestAssertion
    : candidate.baselineComparisonPassed === true;
  const baselineComparisonPassed = Boolean(
    manifestBaselineAssertion
    && candidate.qualityGatePassed === true
    && baseline.qualityGatePassed === true
    && allMetricsNonDegraded
    && repeatedRunEvidenceSufficient
  );
  const blockers = [];
  if (!manifestBaselineAssertion) blockers.push("ARTIFACT_MANIFEST_BASELINE_ASSERTION_FAILED");
  if (candidate.qualityGatePassed !== true) blockers.push("CANDIDATE_QUALITY_GATE_FAILED");
  for (const item of deltas) {
    if (!item.nonDegraded) blockers.push(`BASELINE_DEGRADATION_${item.metric}`);
  }
  if (!identityNonDegraded) blockers.push("BASELINE_IDENTITY_NON_DEGRADATION_FAILED");
  if (!safetyNonDegraded) blockers.push("BASELINE_SAFETY_NON_DEGRADATION_FAILED");
  if (!reproducibilityNonDegraded) blockers.push("BASELINE_REPRODUCIBILITY_NON_DEGRADATION_FAILED");
  if (!repeatedRunEvidenceSufficient) blockers.push("REPEATED_RUN_EVIDENCE_INSUFFICIENT");

  const comparisonMaterial = {
    businessId: String(businessId),
    locationId: String(locationId),
    candidateEvaluationId: String(candidate._id),
    baselineEvaluationId: String(baseline._id),
    toolKey: candidate.toolKey,
    requestedAction: candidate.requestedAction,
    evidenceId: candidate.evidenceId,
    policyVersion: candidate.policyVersion,
    candidateVersion: candidate.candidateVersion,
    baselineVersion: candidate.baselineVersion,
    artifactSha256,
    manifestBaselineAssertion,
    metricDeltas: deltas,
    identityNonDegraded,
    safetyNonDegraded,
    reproducibilityNonDegraded,
    repeatedRunEvidenceSufficient,
    allMetricsNonDegraded,
    blockers,
  };

  const comparison = await AiBaselineComparisonEvidence.findOneAndUpdate(
    { business: businessId, location: locationId, candidateEvaluation: candidate._id },
    {
      $set: {
        baselineEvaluation: baseline._id,
        toolKey: candidate.toolKey,
        requestedAction: candidate.requestedAction,
        evidenceId: candidate.evidenceId,
        policyVersion: candidate.policyVersion,
        candidateKind: candidate.candidateKind,
        candidateVersion: candidate.candidateVersion,
        baselineVersion: candidate.baselineVersion,
        artifactSha256,
        manifestBaselineAssertion,
        metricDeltas: deltas,
        identityNonDegraded,
        safetyNonDegraded,
        reproducibilityNonDegraded,
        repeatedRunEvidenceSufficient,
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
  );

  candidate.baselineManifestAssertion = manifestBaselineAssertion;
  candidate.baselineComparisonSource = "evidence_derived";
  candidate.baselineComparisonEvidence = comparison._id;
  candidate.baselineComparisonPassed = baselineComparisonPassed;
  candidate.artifactPromotionEligible = Boolean(
    baselineComparisonPassed && candidate.model?.artifactLifecycle === "candidate"
  );
  candidate.productionPromotionAuthorised = false;
  candidate.productionInferenceAuthorised = false;
  candidate.externalWriteAuthorised = false;
  await candidate.save();

  const qualifyingOfflineCases = candidate.artifactPromotionEligible
    ? await qualifyingEvidenceCaseCount(candidate)
    : 0;
  const requiredOfflineCases = Math.max(1, Number(candidate.promotionReadiness?.requiredOfflineCases) || 25);
  const suiteGatePassed = qualifyingOfflineCases >= requiredOfflineCases;
  const eligibleForPromotionReview = Boolean(
    candidate.qualityGatePassed === true
    && candidate.baselineComparisonPassed === true
    && candidate.baselineComparisonSource === "evidence_derived"
    && candidate.baselineComparisonEvidence
    && candidate.artifactPromotionEligible === true
    && candidate.promotionReadiness?.repeatedRunEvidenceSufficient === true
    && suiteGatePassed
  );

  candidate.promotionReadiness.qualifyingOfflineCases = qualifyingOfflineCases;
  candidate.promotionReadiness.suiteGatePassed = suiteGatePassed;
  candidate.eligibleForPromotionReview = eligibleForPromotionReview;
  candidate.promotionReviewStatus = eligibleForPromotionReview ? "pending_review" : "not_eligible";
  await candidate.save();

  comparison.qualifyingOfflineCases = qualifyingOfflineCases;
  comparison.requiredOfflineCases = requiredOfflineCases;
  comparison.suiteGatePassed = suiteGatePassed;
  comparison.productionPromotionAuthorised = false;
  comparison.productionInferenceAuthorised = false;
  comparison.deploymentAuthorised = false;
  comparison.externalWriteAuthorised = false;
  await comparison.save();

  return {
    comparison: comparison.toObject(),
    candidateEvaluation: candidate.toObject(),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
    message: baselineComparisonPassed
      ? "Evidence-derived baseline non-degradation passed. Benchmark-suite and human-review gates still apply; no production action was authorised."
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
