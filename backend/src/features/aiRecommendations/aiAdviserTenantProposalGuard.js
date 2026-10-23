import mongoose from "mongoose";

import AiActionProposal from "../aiPlatform/AiActionProposal.js";
import {
  hasRequestPermission,
} from "../../middleware/permissionMiddleware.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";

const ACTION_PERMISSIONS = Object.freeze({
  "appointment.reschedule_review": "appointment:update",
  "appointment.cancel_review": "appointment:cancel",
  "customer.follow_up_review": "communications:manage",
  "communications.campaign_review": "communications:manage",
  "inventory.restock_review": "inventory:manage",
  "service.catalogue_review": "service:update",
});

function text(value) {
  return String(value ?? "").trim();
}

export function effectiveBusinessId(request) {
  const value =
    request?.effectiveAuthority?.businessId ||
    request?.tenantContext?.businessId ||
    null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("Trusted tenant authority is required.", 403, {
      code: "AI_PROPOSAL_TENANT_AUTHORITY_REQUIRED",
    });
  }
  return String(value);
}

export function effectiveLocationId(request) {
  const value =
    request?.effectiveAuthority?.locationId ||
    request?.tenantContext?.locationId ||
    null;
  return mongoose.isValidObjectId(value) ? String(value) : null;
}

export function assertProposalActionPermission(request, actionType) {
  const permission = ACTION_PERMISSIONS[text(actionType)];
  if (!permission) {
    throw createServiceError("Unsupported SalonAI Adviser proposal type.", 400, {
      code: "AI_ACTION_PROPOSAL_TYPE_UNSUPPORTED",
    });
  }
  if (!hasRequestPermission(request, permission)) {
    throw createServiceError(
      "You do not have effective tenant permission for this proposed action.",
      403,
      {
        code: "AI_ACTION_PROPOSAL_PERMISSION_REQUIRED",
        permission,
      }
    );
  }
  return permission;
}

export async function findTenantProposal(request, proposalId) {
  if (!mongoose.isValidObjectId(proposalId)) {
    throw createServiceError("AI proposal identifier is invalid.", 400, {
      code: "AI_ACTION_PROPOSAL_ID_INVALID",
    });
  }

  const proposal = await AiActionProposal.findOne({
    _id: proposalId,
    business: effectiveBusinessId(request),
  });
  if (!proposal) {
    throw createServiceError("SalonAI Adviser proposal was not found.", 404, {
      code: "AI_ACTION_PROPOSAL_NOT_FOUND",
    });
  }

  if (!hasRequestPermission(request, proposal.requiredPermission)) {
    throw createServiceError(
      "You do not have effective tenant permission to govern this proposal.",
      403,
      {
        code: "AI_ACTION_PROPOSAL_PERMISSION_REQUIRED",
        permission: proposal.requiredPermission,
      }
    );
  }
  return proposal;
}

export async function bindProposalToTenant(request, proposal) {
  proposal.business = effectiveBusinessId(request);
  proposal.location = effectiveLocationId(request);
  await proposal.save();
  return proposal;
}

export default {
  assertProposalActionPermission,
  bindProposalToTenant,
  effectiveBusinessId,
  effectiveLocationId,
  findTenantProposal,
};
