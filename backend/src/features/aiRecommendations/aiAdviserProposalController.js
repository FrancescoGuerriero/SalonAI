import {
  createAdviserActionProposal,
  reviewAdviserActionProposal,
} from "./aiAdviserProposalService.js";
import {
  listAiWorkforceProposals,
} from "../aiPlatform/aiWorkforceGovernanceService.js";
import {
  assertProposalActionPermission,
  bindProposalToTenant,
  effectiveBusinessId,
  effectiveLocationId,
  findTenantProposal,
} from "./aiAdviserTenantProposalGuard.js";

function requestId(request) {
  return (
    request.id ||
    request.requestId ||
    request.headers?.["x-request-id"] ||
    ""
  );
}

function authorityUser(request) {
  const base =
    typeof request.user?.toObject === "function"
      ? request.user.toObject()
      : { ...(request.user || {}) };
  const permissions = Array.isArray(request.effectiveAuthority?.permissions)
    ? [...request.effectiveAuthority.permissions]
    : [];
  return {
    ...base,
    permissions,
    rolePermissions: permissions,
  };
}

function governanceContext(request) {
  return {
    businessId: effectiveBusinessId(request),
    effectiveAuthority: request.effectiveAuthority,
  };
}

export async function createProposal(request, response) {
  assertProposalActionPermission(request, request.body?.actionType);

  const proposal = await createAdviserActionProposal({
    ...request.body,
    user: authorityUser(request),
    requestId: requestId(request),
  });
  await bindProposalToTenant(request, proposal);

  return response.status(201).json({
    success: true,
    proposal,
    execution: {
      automatic: false,
      message:
        "This records a tenant-scoped proposed action for human review. It does not execute the underlying business change.",
    },
  });
}

export async function listProposals(request, response) {
  const proposals = await listAiWorkforceProposals(
    {
      status: request.query?.status,
      agentKey: request.query?.agentKey,
      location: request.query?.location,
      limit: request.query?.limit,
    },
    governanceContext(request)
  );

  return response.json({
    success: true,
    proposals,
  });
}

export async function reviewProposal(request, response) {
  await findTenantProposal(request, request.params.proposalId);

  const proposal = await reviewAdviserActionProposal({
    proposalId: request.params.proposalId,
    decision: request.body?.decision,
    note: request.body?.note,
    user: authorityUser(request),
    requestId: requestId(request),
  });

  return response.json({
    success: true,
    proposal,
    tenant: {
      businessId: effectiveBusinessId(request),
      locationId: effectiveLocationId(request),
    },
    execution: {
      automatic: false,
      message:
        proposal.status === "approved"
          ? "Approval is recorded. The underlying change must still be completed through its governed SalonAI workflow."
          : "The proposal was rejected and will not be executed.",
    },
  });
}

export default {
  createProposal,
  listProposals,
  reviewProposal,
};
