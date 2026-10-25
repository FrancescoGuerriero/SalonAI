import AiAdvisoryCandidateEvaluation from "../../models/AiAdvisoryCandidateEvaluation.js";
import AiPromotionProposalDossier from "../../models/AiPromotionProposalDossier.js";
import { createServiceError } from "../../shared/serviceError.js";

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function actorId(actor) {
  return actor?._id || actor?.id || null;
}

function proposalText(payload = {}) {
  return {
    rationale: text(payload.rationale, 6000),
    expectedBenefit: text(payload.expectedBenefit, 4000),
    riskAssessment: text(payload.riskAssessment, 6000),
    rollbackPlan: text(payload.rollbackPlan, 6000),
    monitoringPlan: text(payload.monitoringPlan, 6000),
    incidentOwner: text(payload.incidentOwner, 240),
    proposedDeploymentWindow: text(payload.proposedDeploymentWindow, 240),
  };
}

function checklistFromText(fields) {
  return {
    rollbackPlanDocumented: fields.rollbackPlan.length >= 20,
    monitoringPlanDocumented: fields.monitoringPlan.length >= 20,
    incidentOwnerAssigned: fields.incidentOwner.length >= 2,
    deploymentWindowDocumented: fields.proposedDeploymentWindow.length >= 4,
    humanApprovalPathDocumented: false,
    externalWriteScopeDocumented: false,
  };
}

function readinessComplete(dossier) {
  const checklist = dossier.checklist || {};
  return Boolean(
    dossier.rationale?.trim()
    && dossier.expectedBenefit?.trim()
    && dossier.riskAssessment?.trim()
    && checklist.rollbackPlanDocumented
    && checklist.monitoringPlanDocumented
    && checklist.incidentOwnerAssigned
    && checklist.deploymentWindowDocumented
  );
}

async function acceptedCandidate(recordId, { businessId, locationId }) {
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
  if (
    record.promotionReviewStatus !== "accepted_for_promotion_proposal"
    || record.eligibleForPromotionReview !== true
    || record.qualityGatePassed !== true
    || record.baselineComparisonPassed !== true
    || record.baselineComparisonSource !== "evidence_derived"
    || !record.baselineComparisonEvidence
    || record.artifactPromotionEligible !== true
    || record.promotionReadiness?.suiteGatePassed !== true
  ) {
    throw createServiceError("Candidate has not passed the complete evidence-derived governance chain required for a promotion proposal dossier.", 409, {
      code: "AI_PROMOTION_PROPOSAL_CANDIDATE_NOT_READY",
    });
  }
  if (!record.model?.artifactSha256) {
    throw createServiceError("Candidate does not contain governed model artifact provenance.", 409, {
      code: "AI_PROMOTION_PROPOSAL_ARTIFACT_REQUIRED",
    });
  }
  return record;
}

export async function createPromotionProposal(payload = {}, { businessId, locationId, actor = null } = {}) {
  const candidateEvaluationId = text(payload.candidateEvaluationId, 80);
  if (!candidateEvaluationId) {
    throw createServiceError("candidateEvaluationId is required.", 400, {
      code: "AI_PROMOTION_PROPOSAL_CANDIDATE_REQUIRED",
    });
  }
  const candidate = await acceptedCandidate(candidateEvaluationId, { businessId, locationId });
  const existing = await AiPromotionProposalDossier.findOne({
    business: businessId,
    location: locationId,
    candidateEvaluation: candidate._id,
  }).lean();
  if (existing) {
    throw createServiceError("A promotion proposal dossier already exists for this candidate evaluation.", 409, {
      code: "AI_PROMOTION_PROPOSAL_ALREADY_EXISTS",
      dossierId: existing._id,
    });
  }

  const fields = proposalText(payload);
  const dossier = await AiPromotionProposalDossier.create({
    business: businessId,
    location: locationId,
    candidateEvaluation: candidate._id,
    toolKey: candidate.toolKey,
    candidateKind: candidate.candidateKind,
    candidateVersion: candidate.candidateVersion,
    model: {
      name: candidate.model?.name || "",
      version: candidate.model?.version || "",
      algorithm: candidate.model?.algorithm || "",
      artifactSha256: candidate.model?.artifactSha256,
    },
    governance: {
      registryVersion: candidate.registryVersion || "",
      evaluationPolicyVersion: candidate.policyVersion,
      baselineVersion: candidate.baselineVersion,
      assessmentHash: candidate.assessmentHash,
      evidenceId: candidate.evidenceId,
      evidenceChecksum: candidate.evidenceChecksum,
      qualifyingOfflineCases: candidate.promotionReadiness?.qualifyingOfflineCases || 0,
      requiredOfflineCases: candidate.promotionReadiness?.requiredOfflineCases || 1,
      minimumRepeatedRunsPerCase: candidate.promotionReadiness?.minimumRepeatedRunsPerCase || 1,
    },
    ...fields,
    checklist: checklistFromText(fields),
    proposalStatus: "draft",
    createdBy: actorId(actor),
    updatedBy: actorId(actor),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
  });

  return {
    dossier,
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
    message: "A non-executing promotion proposal dossier was created. It records governance evidence only and does not authorise deployment, promotion or inference.",
  };
}

export async function updatePromotionProposal(dossierId, payload = {}, { businessId, locationId, actor = null, now = new Date() } = {}) {
  const dossier = await AiPromotionProposalDossier.findOne({
    _id: dossierId,
    business: businessId,
    location: locationId,
  });
  if (!dossier) {
    throw createServiceError("AI promotion proposal dossier was not found for the selected location.", 404, {
      code: "AI_PROMOTION_PROPOSAL_NOT_FOUND",
    });
  }
  if (dossier.proposalStatus === "withdrawn") {
    throw createServiceError("A withdrawn promotion proposal dossier cannot be changed.", 409, {
      code: "AI_PROMOTION_PROPOSAL_WITHDRAWN",
    });
  }

  const current = proposalText(dossier.toObject());
  const incoming = proposalText(payload);
  const fields = Object.fromEntries(
    Object.entries(current).map(([key, value]) => [key, Object.prototype.hasOwnProperty.call(payload, key) ? incoming[key] : value])
  );
  Object.assign(dossier, fields);
  dossier.checklist = {
    ...checklistFromText(fields),
    humanApprovalPathDocumented: payload.humanApprovalPathDocumented === true
      || dossier.checklist?.humanApprovalPathDocumented === true,
    externalWriteScopeDocumented: payload.externalWriteScopeDocumented === true
      || dossier.checklist?.externalWriteScopeDocumented === true,
  };
  dossier.updatedBy = actorId(actor);

  if (payload.action === "mark_ready_for_change_review") {
    if (!readinessComplete(dossier)) {
      throw createServiceError("The promotion proposal dossier is missing mandatory change-planning evidence.", 409, {
        code: "AI_PROMOTION_PROPOSAL_INCOMPLETE",
      });
    }
    dossier.proposalStatus = "ready_for_change_review";
    dossier.changeReviewRequestedAt = now;
  } else if (payload.action === "withdraw") {
    dossier.proposalStatus = "withdrawn";
  } else if (payload.action && payload.action !== "save") {
    throw createServiceError("Unsupported promotion proposal dossier action.", 400, {
      code: "AI_PROMOTION_PROPOSAL_ACTION_INVALID",
    });
  } else if (dossier.proposalStatus === "ready_for_change_review") {
    dossier.proposalStatus = "draft";
    dossier.changeReviewRequestedAt = null;
  }

  dossier.productionPromotionAuthorised = false;
  dossier.productionInferenceAuthorised = false;
  dossier.deploymentAuthorised = false;
  dossier.externalWriteAuthorised = false;
  await dossier.save();

  return {
    dossier: dossier.toObject(),
    productionPromotionAuthorised: false,
    productionInferenceAuthorised: false,
    deploymentAuthorised: false,
    externalWriteAuthorised: false,
    message: dossier.proposalStatus === "ready_for_change_review"
      ? "The dossier is ready for a future controlled change review. No deployment, promotion or inference was authorised."
      : "Promotion proposal dossier updated. No deployment, promotion or inference was authorised.",
  };
}

export async function listPromotionProposals(query = {}, { businessId, locationId } = {}) {
  const match = { business: businessId, location: locationId };
  if (["draft", "ready_for_change_review", "withdrawn"].includes(query.proposalStatus)) {
    match.proposalStatus = query.proposalStatus;
  }
  if (query.toolKey) match.toolKey = text(query.toolKey, 120);
  const limit = Math.min(250, Math.max(1, Number.parseInt(query.limit, 10) || 50));
  return AiPromotionProposalDossier.find(match)
    .select("location candidateEvaluation toolKey candidateKind candidateVersion model governance proposalStatus rationale expectedBenefit riskAssessment rollbackPlan monitoringPlan incidentOwner proposedDeploymentWindow checklist createdBy updatedBy changeReviewRequestedAt productionPromotionAuthorised productionInferenceAuthorised deploymentAuthorised externalWriteAuthorised createdAt updatedAt")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export async function getPromotionProposal(dossierId, { businessId, locationId } = {}) {
  const dossier = await AiPromotionProposalDossier.findOne({
    _id: dossierId,
    business: businessId,
    location: locationId,
  }).lean();
  if (!dossier) {
    throw createServiceError("AI promotion proposal dossier was not found for the selected location.", 404, {
      code: "AI_PROMOTION_PROPOSAL_NOT_FOUND",
    });
  }
  return dossier;
}

export default {
  createPromotionProposal,
  getPromotionProposal,
  listPromotionProposals,
  updatePromotionProposal,
};