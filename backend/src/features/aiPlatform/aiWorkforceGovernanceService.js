import mongoose from "mongoose";

import AuditLog from "../../models/AuditLog.js";
import AiActionOutcome, {
  AI_ACTION_OUTCOME_STATUSES,
} from "./AiActionOutcome.js";
import AiActionProposal from "./AiActionProposal.js";
import AiAgentDefinition from "./AiAgentDefinition.js";
import AiAgentRun from "./AiAgentRun.js";
import {
  AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING,
} from "./aiWorkforcePolicy.js";
import {
  listBuiltinAiAgentDefinitions,
} from "./aiWorkforceBuiltinAgents.js";
import {
  listAiWorkforceTools,
} from "./aiWorkforceToolRegistry.js";
import {
  hasEffectivePermission,
} from "../../services/effectiveAuthorityService.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  return mongoose.isValidObjectId(value) ? value : null;
}

function boundedLimit(value, fallback = 50) {
  const parsed = Number(value);
  return Math.max(1, Math.min(200, Number.isFinite(parsed) ? parsed : fallback));
}

function booleanOrNull(value) {
  if (value === true || value === false) return value;
  return null;
}

function optionalNumber(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw createServiceError(`${field} must be a finite number.`, 400, { field });
  }
  return parsed;
}

function uniqueStrings(value, max = 50) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => text(item))
        .filter(Boolean)
        .slice(0, max)
    ),
  ];
}

function assertTenantAuthority({ businessId, effectiveAuthority }) {
  objectId(businessId, "business");
  if (
    !effectiveAuthority ||
    String(effectiveAuthority.businessId || "") !== String(businessId)
  ) {
    throw createServiceError("Trusted tenant authority is required.", 403, {
      code: "AI_WORKFORCE_TENANT_AUTHORITY_REQUIRED",
    });
  }
}

function assertProposalPermission(proposal, effectiveAuthority) {
  if (!hasEffectivePermission(effectiveAuthority, proposal.requiredPermission)) {
    throw createServiceError(
      "You do not have effective tenant permission to govern this AI proposal.",
      403,
      {
        code: "AI_WORKFORCE_PROPOSAL_PERMISSION_REQUIRED",
        permission: proposal.requiredPermission,
      }
    );
  }
}

export async function getAiWorkforceRegistry({ businessId, effectiveAuthority } = {}) {
  assertTenantAuthority({ businessId, effectiveAuthority });

  const persistedAgents = await AiAgentDefinition.find({
    lifecycle: { $in: ["active", "draft"] },
  })
    .sort({ key: 1, createdAt: -1 })
    .lean();

  const builtinAgents = listBuiltinAiAgentDefinitions();
  const byIdentity = new Map();
  for (const agent of [...builtinAgents, ...persistedAgents]) {
    byIdentity.set(`${agent.key}@${agent.version}`, agent);
  }

  return {
    autonomyCeiling: AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING,
    agents: [...byIdentity.values()],
    tools: listAiWorkforceTools(),
    executionPolicy: {
      directMutationEnabled: false,
      consequentialActionsRequireProposalReview: true,
      automaticApprovedProposalExecution: false,
    },
  };
}

export async function listAiWorkforceRuns(query = {}, { businessId, effectiveAuthority } = {}) {
  assertTenantAuthority({ businessId, effectiveAuthority });
  const match = { business: businessId };
  if (query.agentKey) match.agentKey = text(query.agentKey).toLowerCase();
  if (query.status) match.status = text(query.status).toLowerCase();
  if (query.location) match.location = objectId(query.location, "location");

  return AiAgentRun.find(match)
    .populate("agentDefinition", "key version displayName lifecycle autonomyCeiling")
    .sort({ startedAt: -1, _id: -1 })
    .limit(boundedLimit(query.limit))
    .lean();
}

export async function listAiWorkforceProposals(
  query = {},
  { businessId, effectiveAuthority } = {}
) {
  assertTenantAuthority({ businessId, effectiveAuthority });
  const match = { business: businessId };
  if (query.status) match.status = text(query.status).toLowerCase();
  if (query.agentKey) match.agentKey = text(query.agentKey).toLowerCase();
  if (query.location) match.location = objectId(query.location, "location");

  const proposals = await AiActionProposal.find(match)
    .sort({ createdAt: -1, _id: -1 })
    .limit(boundedLimit(query.limit) * 2)
    .lean();

  return proposals
    .filter((proposal) =>
      hasEffectivePermission(effectiveAuthority, proposal.requiredPermission)
    )
    .slice(0, boundedLimit(query.limit));
}

export async function listAiActionOutcomes(
  query = {},
  { businessId, effectiveAuthority } = {}
) {
  assertTenantAuthority({ businessId, effectiveAuthority });
  const match = { business: businessId };
  if (query.proposal) match.proposal = objectId(query.proposal, "proposal");
  if (query.agentKey) match.agentKey = text(query.agentKey).toLowerCase();
  if (query.status) match.status = text(query.status).toLowerCase();

  return AiActionOutcome.find(match)
    .populate("proposal", "actionType domain targetType targetId summary status requiredPermission")
    .populate("agentRun", "agentKey agentVersion status startedAt completedAt")
    .sort({ observedAt: -1, _id: -1 })
    .limit(boundedLimit(query.limit))
    .lean();
}

export async function observeAiActionOutcome(
  proposalId,
  payload = {},
  { businessId, locationId = null, effectiveAuthority, user, requestId = "" } = {}
) {
  assertTenantAuthority({ businessId, effectiveAuthority });
  objectId(proposalId, "proposal");

  const proposal = assertFound(
    await AiActionProposal.findOne({
      _id: proposalId,
      business: businessId,
    }),
    "AI action proposal not found."
  );
  assertProposalPermission(proposal, effectiveAuthority);

  if (proposal.status !== "approved") {
    throw createServiceError(
      "Outcome observations can only be recorded for an approved AI proposal.",
      409,
      { code: "AI_WORKFORCE_OUTCOME_PROPOSAL_NOT_APPROVED" }
    );
  }

  const status = text(payload.status).toLowerCase().replaceAll("-", "_");
  if (!AI_ACTION_OUTCOME_STATUSES.includes(status)) {
    throw createServiceError(
      `status must be one of: ${AI_ACTION_OUTCOME_STATUSES.join(", ")}.`,
      400,
      { field: "status" }
    );
  }

  const observedBy = actorId(user);
  if (!observedBy) {
    throw createServiceError("An authenticated outcome observer is required.", 401);
  }

  const outcome = await AiActionOutcome.create({
    business: businessId,
    location:
      proposal.location ||
      (mongoose.isValidObjectId(locationId) ? locationId : null),
    proposal: proposal._id,
    agentRun: proposal.agentRun || null,
    agentKey: proposal.agentKey || "",
    status,
    taskSuccess: booleanOrNull(payload.taskSuccess),
    policyViolation: payload.policyViolation === true,
    overridden: payload.overridden === true,
    reversed: status === "reversed" || payload.reversed === true,
    businessMetricKey: text(payload.businessMetricKey).slice(0, 160),
    businessMetricDelta: optionalNumber(
      payload.businessMetricDelta,
      "businessMetricDelta"
    ),
    evidenceRefs: uniqueStrings(payload.evidenceRefs),
    note: text(payload.note).slice(0, 2000),
    observedBy,
    observedAt: new Date(),
    metadata:
      payload.metadata &&
      typeof payload.metadata === "object" &&
      !Array.isArray(payload.metadata)
        ? payload.metadata
        : {},
  });

  if (proposal.agentRun) {
    await AiAgentRun.updateOne(
      { _id: proposal.agentRun, business: businessId },
      {
        $set: {
          "outcome.taskSuccess": outcome.taskSuccess,
          "outcome.humanApproved": true,
          "outcome.overridden": outcome.overridden,
          "outcome.reversed": outcome.reversed,
          "outcome.policyViolation": outcome.policyViolation,
          "outcome.businessMetricKey": outcome.businessMetricKey,
          "outcome.businessMetricDelta": outcome.businessMetricDelta,
        },
      }
    );
  }

  await AuditLog.create({
    actor: observedBy,
    action: "ai_workforce.proposal_outcome_observed",
    resourceType: "AiActionProposal",
    resourceId: String(proposal._id),
    requestId: text(requestId),
    after: {
      outcomeId: String(outcome._id),
      status: outcome.status,
      taskSuccess: outcome.taskSuccess,
      policyViolation: outcome.policyViolation,
      reversed: outcome.reversed,
    },
    metadata: {
      businessId: String(businessId),
      agentKey: proposal.agentKey || "",
      requiredPermission: proposal.requiredPermission,
      automaticExecution: false,
    },
  });

  return outcome.toObject();
}

export default {
  getAiWorkforceRegistry,
  listAiActionOutcomes,
  listAiWorkforceProposals,
  listAiWorkforceRuns,
  observeAiActionOutcome,
};
