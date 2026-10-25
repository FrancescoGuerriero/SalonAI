import { createHash } from "node:crypto";

import AiAdvisoryCandidateEvaluation from "../../models/AiAdvisoryCandidateEvaluation.js";
import { createServiceError } from "../../shared/serviceError.js";

const EVIDENCE_CONTRACT = "data_hub_evidence_v1";
const MODEL_ARTIFACT_SCHEMA = "salonai.model-artifact.v1";
const DEFAULT_TIMEOUT_MS = 10000;
const SHA256_RE = /^[0-9a-f]{64}$/;

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function actorId(actor) {
  return actor?._id || actor?.id || null;
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function gatewayConfiguration() {
  const baseUrl = text(process.env.AI_SERVICE_BASE_URL || process.env.AI_SERVICE_URL, 2000).replace(/\/$/, "");
  const serviceKey = text(process.env.AI_SERVICE_SERVICE_KEY || process.env.AI_SERVICE_KEY, 20000);
  if (!baseUrl || !serviceKey) {
    throw createServiceError("AI Gateway is not configured for this environment.", 503, {
      code: "AI_GATEWAY_NOT_CONFIGURED",
    });
  }
  const parsed = new URL(baseUrl);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw createServiceError("AI Gateway base URL is invalid.", 500, { code: "AI_GATEWAY_URL_INVALID" });
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw createServiceError("Production AI Gateway requires HTTPS.", 500, { code: "AI_GATEWAY_HTTPS_REQUIRED" });
  }
  return { baseUrl, serviceKey };
}

async function gatewayRequest(path, { method = "GET", payload = null } = {}, { baseUrl, serviceKey }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(payload ? { "content-type": "application/json" } : {}),
        "X-SalonAI-Service-Key": serviceKey,
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: text(raw, 2000) }; }
    if (!response.ok) {
      throw createServiceError(`AI Gateway returned HTTP ${response.status}.`, response.status, {
        code: body?.detail?.code || body?.code || "AI_CANDIDATE_EVALUATION_FAILED",
        gatewayResponse: body,
      });
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createServiceError("AI candidate evaluation timed out.", 504, {
        code: "AI_CANDIDATE_EVALUATION_TIMEOUT",
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function validateEvidenceEnvelope(evidence, { businessId, locationId }) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw createServiceError("A canonical AI evidence envelope is required.", 400, {
      code: "AI_EVALUATION_EVIDENCE_REQUIRED",
    });
  }
  if (evidence.contract !== EVIDENCE_CONTRACT) {
    throw createServiceError("Unsupported AI evidence contract.", 409, {
      code: "AI_EVALUATION_EVIDENCE_CONTRACT_MISMATCH",
    });
  }
  if (String(evidence.business_id || "") !== String(businessId)) {
    throw createServiceError("AI evidence belongs to a different business.", 403, {
      code: "AI_EVALUATION_BUSINESS_MISMATCH",
    });
  }
  if (String(evidence.location_id || "") !== String(locationId)) {
    throw createServiceError("AI evidence belongs to a different location.", 403, {
      code: "AI_EVALUATION_LOCATION_MISMATCH",
    });
  }
  const facts = Array.isArray(evidence.facts) ? evidence.facts : [];
  const provenance = Array.isArray(evidence.provenance) ? evidence.provenance : [];
  if (!facts.length || facts.length > 500 || !provenance.length || provenance.length > 200) {
    throw createServiceError("AI evidence exceeds the governed evidence bounds.", 400, {
      code: "AI_EVALUATION_EVIDENCE_BOUNDS_INVALID",
    });
  }
  const generatedAt = evidence.generated_at;
  const sourceContractVersion = evidence?.metadata?.sourceContractVersion;
  if (!generatedAt || !sourceContractVersion) {
    throw createServiceError("AI evidence provenance metadata is incomplete.", 400, {
      code: "AI_EVALUATION_EVIDENCE_PROVENANCE_INCOMPLETE",
    });
  }
  const fingerprintInput = JSON.stringify({
    businessId: String(businessId),
    locationId: String(locationId),
    generatedAt,
    contractVersion: sourceContractVersion,
    facts,
    provenance,
  });
  const expectedEvidenceId = sha256(fingerprintInput);
  if (expectedEvidenceId !== text(evidence.evidence_id, 64)) {
    throw createServiceError("AI evidence fingerprint verification failed.", 409, {
      code: "AI_EVALUATION_EVIDENCE_FINGERPRINT_MISMATCH",
    });
  }
  return {
    evidenceId: expectedEvidenceId,
    evidenceChecksum: sha256(evidence),
    factCount: facts.length,
    provenanceCount: provenance.length,
  };
}

function validateCandidate(candidate, evidenceId, locationId) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw createServiceError("An advisory candidate output is required.", 400, {
      code: "AI_EVALUATION_CANDIDATE_REQUIRED",
    });
  }
  if (String(candidate.evidence_id || "") !== evidenceId || String(candidate.location_id || "") !== String(locationId)) {
    throw createServiceError("The advisory candidate is not bound to the selected location evidence.", 409, {
      code: "AI_EVALUATION_CANDIDATE_IDENTITY_MISMATCH",
    });
  }
  if (!candidate.advisory_version) {
    throw createServiceError("The advisory candidate version is required.", 400, {
      code: "AI_EVALUATION_CANDIDATE_VERSION_REQUIRED",
    });
  }
  return sha256(candidate);
}

function validateModelArtifact(manifest, kind, { businessId, locationId }) {
  if (kind === "deterministic_baseline") {
    return {
      model: {},
      baselineComparisonPassed: true,
      artifactPromotionEligible: false,
    };
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw createServiceError("A governed model artifact manifest is required for model candidates.", 400, {
      code: "AI_MODEL_ARTIFACT_MANIFEST_REQUIRED",
    });
  }
  if (manifest.schemaVersion !== MODEL_ARTIFACT_SCHEMA) {
    throw createServiceError("The model artifact manifest schema is not supported.", 409, {
      code: "AI_MODEL_ARTIFACT_SCHEMA_MISMATCH",
    });
  }
  const model = manifest.model || {};
  const dataset = manifest.dataset || {};
  const scope = dataset.scope || {};
  const artifact = manifest.artifact || {};
  const evaluation = manifest.evaluation || {};
  const artifactHash = text(artifact.sha256, 64).toLowerCase();
  if (!text(model.name, 160) || !text(model.version, 160) || !text(model.algorithm, 160)) {
    throw createServiceError("Model artifact identity is incomplete.", 400, {
      code: "AI_MODEL_ARTIFACT_IDENTITY_INCOMPLETE",
    });
  }
  if (!SHA256_RE.test(artifactHash)) {
    throw createServiceError("Model artifact checksum is invalid.", 400, {
      code: "AI_MODEL_ARTIFACT_CHECKSUM_INVALID",
    });
  }
  if (scope.mode !== "single_business" || scope.deidentified !== true || String(scope.business || "") !== String(businessId)) {
    throw createServiceError("Model artifact dataset scope does not match the active business.", 403, {
      code: "AI_MODEL_ARTIFACT_BUSINESS_SCOPE_MISMATCH",
    });
  }
  const locations = Array.isArray(scope.locations) ? scope.locations.map(String) : [];
  if (!locations.includes(String(locationId))) {
    throw createServiceError("Model artifact dataset scope must explicitly include the selected location.", 403, {
      code: "AI_MODEL_ARTIFACT_LOCATION_SCOPE_MISMATCH",
    });
  }
  const lifecycle = text(model.lifecycle, 40);
  if (!["experiment", "candidate"].includes(lifecycle)) {
    throw createServiceError("Model artifact lifecycle is not eligible for governed evaluation.", 409, {
      code: "AI_MODEL_ARTIFACT_LIFECYCLE_INVALID",
    });
  }
  const baselineComparisonPassed = evaluation.beatsRulesBaseline === true;
  return {
    model: {
      name: text(model.name, 160),
      version: text(model.version, 160),
      algorithm: text(model.algorithm, 160),
      artifactSha256: artifactHash,
      artifactManifestSchema: MODEL_ARTIFACT_SCHEMA,
      artifactLifecycle: lifecycle,
    },
    baselineComparisonPassed,
    artifactPromotionEligible: lifecycle === "candidate" && baselineComparisonPassed,
  };
}

function candidateKind(value) {
  if (!["deterministic_baseline", "shadow_model", "offline_model"].includes(value)) {
    throw createServiceError("Candidate kind is not supported.", 400, {
      code: "AI_CANDIDATE_KIND_INVALID",
    });
  }
  return value;
}

function requestedAction(value) {
  return ["analyse", "summarise", "recommend"].includes(value) ? value : "analyse";
}

function metricsFromAssessment(value = {}) {
  return {
    identityMatch: Boolean(value.identity_match),
    citationIntegrityRate: Number(value.citation_integrity_rate || 0),
    factualGroundingRate: Number(value.factual_grounding_rate || 0),
    unsupportedClaimRate: Number(value.unsupported_claim_rate || 0),
    provenanceValidityRate: Number(value.provenance_validity_rate || 0),
    provenanceCoverageRate: Number(value.provenance_coverage_rate || 0),
    safetyCompliance: Boolean(value.safety_compliance),
    reproducible: typeof value.reproducible === "boolean" ? value.reproducible : null,
  };
}

export async function evaluateAndRecordCandidate(payload = {}, { businessId, locationId, actor = null } = {}) {
  const evidence = payload.evidence;
  const candidate = payload.candidate;
  const kind = candidateKind(payload.candidateKind);
  const evidenceAudit = validateEvidenceEnvelope(evidence, { businessId, locationId });
  const candidateOutputHash = validateCandidate(candidate, evidenceAudit.evidenceId, locationId);
  const artifactAudit = validateModelArtifact(payload.modelArtifactManifest, kind, { businessId, locationId });
  const repeatedOutputHashes = Array.isArray(payload.repeatedOutputHashes)
    ? payload.repeatedOutputHashes.map((item) => text(item, 64).toLowerCase()).filter((item) => SHA256_RE.test(item)).slice(0, 20)
    : [];

  const config = gatewayConfiguration();
  const [policy, assessment] = await Promise.all([
    gatewayRequest("/api/v1/ai-gateway/advisory-evaluation-policy", {}, config),
    gatewayRequest("/api/v1/ai-gateway/evaluate-advisory", {
      method: "POST",
      payload: {
        evidence,
        candidate,
        candidate_kind: kind,
        repeated_output_hashes: repeatedOutputHashes,
      },
    }, config),
  ]);

  const qualityGatePassed = assessment.quality_gate_passed === true;
  const evaluatorEligible = assessment.eligible_for_promotion_review === true;
  const eligibleForPromotionReview = Boolean(
    evaluatorEligible
      && artifactAudit.artifactPromotionEligible
      && kind !== "deterministic_baseline"
  );
  const promotionReviewStatus = eligibleForPromotionReview ? "pending_review" : "not_eligible";

  const record = await AiAdvisoryCandidateEvaluation.create({
    business: businessId,
    location: locationId,
    toolKey: text(candidate.tool_key || payload.toolKey || "marketing-insights", 120) || "marketing-insights",
    requestedAction: requestedAction(candidate.requested_action || payload.requestedAction),
    candidateKind: kind,
    registryVersion: text(candidate.registry_version, 40),
    candidateVersion: text(assessment.candidate_version || candidate.advisory_version, 160),
    candidateOutputHash,
    model: artifactAudit.model,
    baselineComparisonPassed: artifactAudit.baselineComparisonPassed,
    artifactPromotionEligible: artifactAudit.artifactPromotionEligible,
    evidenceId: evidenceAudit.evidenceId,
    evidenceContract: EVIDENCE_CONTRACT,
    evidenceChecksum: evidenceAudit.evidenceChecksum,
    factCount: evidenceAudit.factCount,
    provenanceCount: evidenceAudit.provenanceCount,
    policyVersion: text(assessment.policy_version || policy.version, 160),
    baselineVersion: text(policy.baseline, 160),
    assessmentHash: text(assessment.assessment_hash, 64),
    metrics: metricsFromAssessment(assessment.metrics),
    blockers: Array.isArray(assessment.blockers) ? assessment.blockers.map((item) => text(item, 160)).slice(0, 50) : [],
    qualityGatePassed,
    eligibleForPromotionReview,
    promotionReviewStatus,
    requestedBy: actorId(actor),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    externalWriteAuthorised: false,
  });

  return {
    record,
    baselineComparisonPassed: artifactAudit.baselineComparisonPassed,
    evaluatorEligibleForPromotionReview: evaluatorEligible,
    eligibleForPromotionReview,
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    externalWriteAuthorised: false,
    message: eligibleForPromotionReview
      ? "Candidate passed the governed quality, baseline and artifact gates and is queued for human promotion-proposal review only. Production promotion and inference remain disabled."
      : "Candidate evaluation was recorded. It is not eligible for promotion review; production promotion and inference remain disabled.",
  };
}

export async function listCandidateEvaluations(query = {}, { businessId, locationId } = {}) {
  const match = { business: businessId, location: locationId };
  if (query.toolKey) match.toolKey = text(query.toolKey, 120);
  if (["deterministic_baseline", "shadow_model", "offline_model"].includes(query.candidateKind)) {
    match.candidateKind = query.candidateKind;
  }
  if (["not_eligible", "pending_review", "accepted_for_promotion_proposal", "rejected"].includes(query.promotionReviewStatus)) {
    match.promotionReviewStatus = query.promotionReviewStatus;
  }
  const limit = Math.min(250, Math.max(1, Number.parseInt(query.limit, 10) || 50));
  return AiAdvisoryCandidateEvaluation.find(match)
    .select("location toolKey requestedAction candidateKind registryVersion candidateVersion candidateOutputHash model baselineComparisonPassed artifactPromotionEligible evidenceId evidenceContract evidenceChecksum factCount provenanceCount policyVersion baselineVersion assessmentHash metrics blockers qualityGatePassed eligibleForPromotionReview promotionReviewStatus reviewerNote reviewedBy reviewedAt requestedBy productionPromotionAuthorised productionInferenceAuthorised externalWriteAuthorised createdAt updatedAt")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export async function getCandidateEvaluation(recordId, { businessId, locationId } = {}) {
  const record = await AiAdvisoryCandidateEvaluation.findOne({
    _id: recordId,
    business: businessId,
    location: locationId,
  }).lean();
  if (!record) {
    throw createServiceError("AI candidate evaluation record was not found for the selected location.", 404, {
      code: "AI_CANDIDATE_EVALUATION_NOT_FOUND",
    });
  }
  return record;
}

export async function reviewCandidateEvaluation(recordId, payload = {}, { businessId, locationId, actor = null, now = new Date() } = {}) {
  const record = await AiAdvisoryCandidateEvaluation.findOne({
    _id: recordId,
    business: businessId,
    location: locationId,
  });
  if (!record) {
    throw createServiceError("AI candidate evaluation record was not found for the selected location.", 404, {
      code: "AI_CANDIDATE_EVALUATION_NOT_FOUND",
    });
  }
  const decision = payload.decision === "accept" ? "accept" : payload.decision === "reject" ? "reject" : "";
  if (!decision) {
    throw createServiceError("Review decision must be accept or reject.", 400, {
      code: "AI_CANDIDATE_REVIEW_DECISION_INVALID",
    });
  }
  if (decision === "accept" && !record.eligibleForPromotionReview) {
    throw createServiceError("This candidate has not passed the gates required for promotion-proposal review.", 409, {
      code: "AI_CANDIDATE_NOT_ELIGIBLE_FOR_PROMOTION_REVIEW",
    });
  }

  record.promotionReviewStatus = decision === "accept"
    ? "accepted_for_promotion_proposal"
    : "rejected";
  record.reviewerNote = text(payload.note, 2000);
  record.reviewedBy = actorId(actor);
  record.reviewedAt = now;
  record.productionPromotionAuthorised = false;
  record.productionInferenceAuthorised = false;
  record.externalWriteAuthorised = false;
  await record.save();

  return {
    record: record.toObject(),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    externalWriteAuthorised: false,
    message: decision === "accept"
      ? "Human review accepted this candidate for a future promotion proposal only. No production promotion or inference was authorised."
      : "Human review rejected this candidate. No production promotion or inference was authorised.",
  };
}

export default {
  evaluateAndRecordCandidate,
  getCandidateEvaluation,
  listCandidateEvaluations,
  reviewCandidateEvaluation,
};
