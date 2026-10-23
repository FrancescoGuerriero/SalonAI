import {
  prepareApprovedAdviserProposal,
} from "./aiAdviserProposalPreparationService.js";
import {
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

export async function prepareProposalDraft(request, response) {
  await findTenantProposal(request, request.params.proposalId);

  const result = await prepareApprovedAdviserProposal({
    proposalId: request.params.proposalId,
    user: authorityUser(request),
    requestId: requestId(request),
  });

  return response.json({
    success: true,
    ...result,
    execution: {
      automatic: false,
      deliveryTriggered: false,
      message:
        "SalonAI prepared a tenant-authorised draft only. Review and explicitly schedule or launch it through the normal communications workflow.",
    },
  });
}

export default {
  prepareProposalDraft,
};
