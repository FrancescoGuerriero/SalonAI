import { createHash, randomUUID } from "node:crypto";

import AiOfflineExperimentRun from "../../models/AiOfflineExperimentRun.js";
import { createServiceError } from "../../shared/serviceError.js";
import { evaluateAndRecordCandidate } from "./aiCandidateEvaluationService.js";

const SHA256_RE = /^[0-9a-f]{64}$/;
const MAX_CASES = 25;
const MIN_REPEATS = 3;
const MAX_REPEATS = 10;

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function actorId(actor) {
  return actor?._id || actor?.id || null;
}

function candidateKind(value) {
  if (!["shadow_model", "offline_model"].includes(value)) {
    throw createServiceError("Offline experiment candidate kind must be shadow_model or offline_model.", 400, {
      code: "AI_OFFLINE_EXPERIMENT_KIND_INVALID",
    });
  }
  return value;
}

function requestedAction(value) {
  return ["analyse", "summarise", "recommend"].includes(value) ? value : "analyse";
}

function validateManifest(manifest) {
  const hash = text(manifest?.artifact?.sha256, 64).toLowerCase();
  const version = text(manifest?.model?.version, 160);
  if (!SHA256_RE.test(hash) || !version) {
    throw createServiceError("A governed model artifact manifest with version and SHA-256 is required.", 400, {
      code: "AI_OFFLINE_EXPERIMENT_ARTIFACT_INVALID",
    });
  }
  return {
    name: text(manifest?.model?.name, 160),
    version,
    algorithm: text(manifest?.model?.algorithm, 160),
    artifactSha256: hash,
  };
}

function validateRepeatedCandidate(candidate, expectedEvidenceId, expectedLocationId, expectedVersion) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw createServiceError("Repeated experiment outputs must be advisory candidate objects.", 400, {
      code: "AI_OFFLINE_EXPERIMENT_REPEAT_INVALID",
    });
  }
  if (String(candidate.evidence_id || "") !== expectedEvidenceId) {
    throw createServiceError("Repeated output is bound to different evidence.", 409, {
      code: "AI_OFFLINE_EXPERIMENT_REPEAT_EVIDENCE_MISMATCH",
    });
  }
  if (String(candidate.location_id || "") !== String(expectedLocationId)) {
    throw createServiceError("Repeated output is bound to a different location.", 409, {
      code: "AI_OFFLINE_EXPERIMENT_REPEAT_LOCATION_MISMATCH",
    });
  }
  if (text(candidate.advisory_version, 160) !== expectedVersion) {
    throw createServiceError("Repeated output candidate version does not match the primary candidate.", 409, {
      code: "AI_OFFLINE_EXPERIMENT_REPEAT_VERSION_MISMATCH",
    });
  }
}

function validateCase(testCase, locationId) {
  const evidence = testCase?.evidence;
  const candidate = testCase?.candidate;
  const repeatedCandidates = Array.isArray(testCase?.repeatedCandidates) ? testCase.repeatedCandidates : [];
  const evidenceId = text(evidence?.evidence_id, 64);
  const candidateVersion = text(candidate?.advisory_version, 160);
  if (!evidenceId || !candidateVersion) {
    throw createServiceError("Each experiment case requires canonical evidence and a versioned candidate output.", 400, {
      code: "AI_OFFLINE_EXPERIMENT_CASE_INVALID",
    });
  }
  if (String(evidence?.location_id || "") !== String(locationId) || String(candidate?.location_id || "") !== String(locationId)) {
    throw createServiceError("Experiment evidence and candidate must belong to the selected location.", 403, {
      code: "AI_OFFLINE_EXPERIMENT_LOCATION_MISMATCH",
    });
  }
  if (String(candidate?.evidence_id || "") !== evidenceId) {
    throw createServiceError("Experiment candidate must cite the case evidence ID.", 409, {
      code: "AI_OFFLINE_EXPERIMENT_EVIDENCE_MISMATCH",
    });
  }
  if (repeatedCandidates.length < MIN_REPEATS || repeatedCandidates.length > MAX_REPEATS) {
    throw createServiceError(`Each experiment case requires ${MIN_REPEATS}-${MAX_REPEATS} repeated outputs.`, 400, {
      code: "AI_OFFLINE_EXPERIMENT_REPEAT_COUNT_INVALID",
    });
  }
  repeatedCandidates.forEach((item) => validateRepeatedCandidate(item, evidenceId, locationId, candidateVersion));
  const repeatedOutputHashes = repeatedCandidates.map(sha256);
  const primaryHash = sha256(candidate);
  if (!repeatedOutputHashes.includes(primaryHash)) {
    throw createServiceError("Repeated outputs must include the primary candidate output exactly.", 409, {
      code: "AI_OFFLINE_EXPERIMENT_PRIMARY_REPEAT_REQUIRED",
    });
  }
  return { evidence, candidate, repeatedOutputHashes, evidenceId, candidateVersion };
}

function safeError(error) {
  return {
    errorCode: text(error?.code || error?.details?.code || "AI_OFFLINE_EXPERIMENT_CASE_FAILED", 160),
    errorMessage: text(error?.message || "Experiment case failed.", 1000),
  };
}

export async function runOfflineExperiment(payload = {}, { businessId, locationId, actor = null } = {}) {
  const cases = Array.isArray(payload.cases) ? payload.cases : [];
  if (!cases.length || cases.length > MAX_CASES) {
    throw createServiceError(`Offline experiments require 1-${MAX_CASES} cases.`, 400, {
      code: "AI_OFFLINE_EXPERIMENT_CASE_COUNT_INVALID",
    });
  }
  const kind = candidateKind(payload.candidateKind);
  const action = requestedAction(payload.requestedAction);
  const toolKey = text(payload.toolKey || "marketing-insights", 120) || "marketing-insights";
  const model = validateManifest(payload.modelArtifactManifest);
  const runKey = text(payload.runKey, 160) || `offline-${randomUUID()}`;
  const duplicate = await AiOfflineExperimentRun.exists({ business: businessId, location: locationId, runKey });
  if (duplicate) {
    throw createServiceError("An offline experiment run with this runKey already exists for the selected location.", 409, {
      code: "AI_OFFLINE_EXPERIMENT_RUN_KEY_EXISTS",
    });
  }

  const results = [];
  for (let index = 0; index < cases.length; index += 1) {
    const caseId = text(cases[index]?.caseId, 160) || `case-${index + 1}`;
    try {
      const validated = validateCase(cases[index], locationId);
      if (validated.candidateVersion !== model.version) {
        throw createServiceError("Candidate advisory version must match the governed model artifact version.", 409, {
          code: "AI_OFFLINE_EXPERIMENT_MODEL_VERSION_MISMATCH",
        });
      }
      const evaluation = await evaluateAndRecordCandidate({
        evidence: validated.evidence,
        candidate: validated.candidate,
        candidateKind: kind,
        requestedAction: action,
        toolKey,
        modelArtifactManifest: payload.modelArtifactManifest,
        repeatedOutputHashes: validated.repeatedOutputHashes,
      }, { businessId, locationId, actor });
      const record = evaluation.record || {};
      results.push({
        caseId,
        evidenceId: validated.evidenceId,
        evaluationRecord: record._id || null,
        status: "passed",
        qualityGatePassed: record.qualityGatePassed === true,
        baselineComparisonPassed: evaluation.baselineComparisonPassed === true,
        repeatedRunEvidenceSufficient: record.promotionReadiness?.repeatedRunEvidenceSufficient === true,
        eligibleForPromotionReview: evaluation.eligibleForPromotionReview === true,
        repeatedRunCount: record.promotionReadiness?.repeatedRunCount || validated.repeatedOutputHashes.length,
        metrics: record.metrics || {},
        blockers: Array.isArray(record.blockers) ? record.blockers : [],
      });
    } catch (error) {
      const fallbackEvidenceId = text(cases[index]?.evidence?.evidence_id, 64) || sha256({ runKey, caseId }).slice(0, 64);
      results.push({
        caseId,
        evidenceId: fallbackEvidenceId,
        evaluationRecord: null,
        status: "failed",
        qualityGatePassed: false,
        baselineComparisonPassed: false,
        repeatedRunEvidenceSufficient: false,
        eligibleForPromotionReview: false,
        repeatedRunCount: Array.isArray(cases[index]?.repeatedCandidates) ? cases[index].repeatedCandidates.length : 0,
        metrics: {},
        blockers: [],
        ...safeError(error),
      });
    }
  }

  const completedCaseCount = results.filter((item) => item.status === "passed").length;
  const run = await AiOfflineExperimentRun.create({
    business: businessId,
    location: locationId,
    runKey,
    toolKey,
    requestedAction: action,
    candidateKind: kind,
    candidateVersion: model.version,
    model,
    status: completedCaseCount === cases.length ? "completed" : "completed_with_failures",
    requestedCaseCount: cases.length,
    completedCaseCount,
    qualityPassedCases: results.filter((item) => item.qualityGatePassed).length,
    baselinePassedCases: results.filter((item) => item.baselineComparisonPassed).length,
    reproducibleCases: results.filter((item) => item.repeatedRunEvidenceSufficient).length,
    promotionReviewEligibleCases: results.filter((item) => item.eligibleForPromotionReview).length,
    cases: results,
    requestedBy: actorId(actor),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
  });

  return {
    run: run.toObject(),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
    message: "Offline/shadow experiment completed and evaluation evidence was recorded. No training, deployment, production promotion, production inference or external write was authorised.",
  };
}

export async function listOfflineExperiments(query = {}, { businessId, locationId } = {}) {
  const match = { business: businessId, location: locationId };
  if (["shadow_model", "offline_model"].includes(query.candidateKind)) match.candidateKind = query.candidateKind;
  if (["completed", "completed_with_failures"].includes(query.status)) match.status = query.status;
  if (query.artifactSha256 && SHA256_RE.test(String(query.artifactSha256).toLowerCase())) {
    match["model.artifactSha256"] = String(query.artifactSha256).toLowerCase();
  }
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return AiOfflineExperimentRun.find(match)
    .select("location runKey toolKey requestedAction candidateKind candidateVersion model status requestedCaseCount completedCaseCount qualityPassedCases baselinePassedCases reproducibleCases promotionReviewEligibleCases cases requestedBy productionPromotionAuthorised productionInferenceAuthorised deploymentAuthorised externalWriteAuthorised createdAt updatedAt")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export async function getOfflineExperiment(runId, { businessId, locationId } = {}) {
  const run = await AiOfflineExperimentRun.findOne({ _id: runId, business: businessId, location: locationId }).lean();
  if (!run) {
    throw createServiceError("Offline/shadow experiment run was not found for the selected location.", 404, {
      code: "AI_OFFLINE_EXPERIMENT_NOT_FOUND",
    });
  }
  return run;
}

export default { runOfflineExperiment, listOfflineExperiments, getOfflineExperiment };
