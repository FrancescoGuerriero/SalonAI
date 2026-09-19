import AuditLog from "../../models/AuditLog.js";
import {
  COMMUNICATION_CHANNELS,
} from "../../models/CommunicationCampaign.js";
import {
  hasUserPermission,
} from "../../middleware/permissionMiddleware.js";
import {
  duplicateCommunicationCampaign,
} from "../../services/communicationCampaignService.js";
import AiActionProposal from "../aiPlatform/AiActionProposal.js";

const PREPARABLE_ACTION =
  "communications.campaign_review";

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function actorId(user) {
  return (
    user?._id ||
    user?.id ||
    null
  );
}

function preparationError(
  message,
  statusCode,
  code
) {
  const error =
    new Error(
      message
    );
  error.statusCode =
    statusCode;
  error.code =
    code;
  return error;
}

function assertPermission(
  user,
  permission
) {
  if (
    !hasUserPermission(
      user,
      permission
    )
  ) {
    throw preparationError(
      "You no longer have permission to prepare this Adviser proposal.",
      403,
      "AI_ACTION_PREPARATION_PERMISSION_REQUIRED"
    );
  }
}

function normaliseCampaignChannel(
  value
) {
  const channel =
    text(value)
      .toLowerCase();

  if (!channel) {
    return "";
  }

  if (
    !COMMUNICATION_CHANNELS.includes(
      channel
    )
  ) {
    throw preparationError(
      "The proposed communication channel is no longer supported.",
      400,
      "AI_ACTION_PREPARATION_CHANNEL_INVALID"
    );
  }

  return channel;
}

export function isAdviserProposalPreparable(
  actionType
) {
  return (
    text(
      actionType
    ) ===
    PREPARABLE_ACTION
  );
}

export async function prepareCampaignDraftFromProposal(
  proposal,
  user,
  {
    duplicateCampaign =
      duplicateCommunicationCampaign,
  } = {}
) {
  if (
    !proposal ||
    proposal.actionType !==
      PREPARABLE_ACTION
  ) {
    throw preparationError(
      "This Adviser proposal does not support draft preparation.",
      409,
      "AI_ACTION_PREPARATION_UNSUPPORTED"
    );
  }

  const changes =
    proposal.proposedChanges &&
    typeof proposal.proposedChanges ===
      "object"
      ? proposal.proposedChanges
      : {};
  const channel =
    normaliseCampaignChannel(
      changes.channel
    );

  const draft =
    await duplicateCampaign(
      proposal.targetId,
      {
        ...(channel
          ? {
              channel,
            }
          : {}),
        schedule: {
          mode: "draft",
          scheduledAt: null,
        },
      },
      user
    );

  return {
    entityType:
      "communication_campaign",
    entityId:
      String(
        draft?._id ||
        draft?.id ||
        ""
      ),
    status:
      draft?.status ||
      "draft",
    campaign:
      draft,
  };
}

export async function prepareApprovedAdviserProposal({
  proposalId,
  user,
  requestId = "",
} = {}) {
  const proposal =
    await AiActionProposal.findById(
      proposalId
    );

  if (!proposal) {
    throw preparationError(
      "SalonAI Adviser proposal was not found.",
      404,
      "AI_ACTION_PROPOSAL_NOT_FOUND"
    );
  }

  assertPermission(
    user,
    proposal
      .requiredPermission
  );

  if (
    proposal.status !==
      "approved"
  ) {
    throw preparationError(
      "Only approved Adviser proposals can prepare a draft.",
      409,
      "AI_ACTION_PREPARATION_NOT_APPROVED"
    );
  }

  if (
    proposal.expiresAt &&
    new Date(
      proposal.expiresAt
    ) <= new Date()
  ) {
    throw preparationError(
      "This Adviser proposal has expired.",
      409,
      "AI_ACTION_PROPOSAL_EXPIRED"
    );
  }

  if (
    !isAdviserProposalPreparable(
      proposal.actionType
    )
  ) {
    throw preparationError(
      "This proposal remains review-only. SalonAI does not have a safe preparation executor for this action type.",
      409,
      "AI_ACTION_PREPARATION_UNSUPPORTED"
    );
  }

  if (
    proposal.executionStatus ===
      "prepared"
  ) {
    return {
      proposal,
      preparation:
        proposal.executionResult ||
        {},
      idempotent: true,
    };
  }

  const claimed =
    await AiActionProposal.findOneAndUpdate(
      {
        _id:
          proposal._id,
        status:
          "approved",
        executionStatus: {
          $in: [
            "blocked",
            "failed",
          ],
        },
      },
      {
        $set: {
          executionStatus:
            "preparing",
          executionBlockedReason:
            "Preparing a non-delivering SalonAI draft through an approved Adviser proposal.",
          executionError:
            "",
        },
      },
      {
        new: true,
      }
    );

  if (!claimed) {
    const latest =
      await AiActionProposal.findById(
        proposal._id
      );

    if (
      latest
        ?.executionStatus ===
      "prepared"
    ) {
      return {
        proposal:
          latest,
        preparation:
          latest.executionResult ||
          {},
        idempotent: true,
      };
    }

    throw preparationError(
      "This Adviser proposal is already being prepared.",
      409,
      "AI_ACTION_PREPARATION_IN_PROGRESS"
    );
  }

  try {
    const preparation =
      await prepareCampaignDraftFromProposal(
        claimed,
        user
      );
    const now =
      new Date();

    claimed.executionStatus =
      "prepared";
    claimed.executionBlockedReason =
      "A draft was prepared. It remains unscheduled and unsent until a human completes the normal SalonAI campaign workflow.";
    claimed.executionResult = {
      entityType:
        preparation.entityType,
      entityId:
        preparation.entityId,
      status:
        preparation.status,
    };
    claimed.executedBy =
      actorId(
        user
      );
    claimed.executedAt =
      now;
    claimed.executionError =
      "";

    await claimed.save();

    await AuditLog.create({
      actor:
        actorId(
          user
        ),
      action:
        "ai_adviser.proposal_draft_prepared",
      resourceType:
        "AiActionProposal",
      resourceId:
        String(
          claimed._id
        ),
      requestId:
        text(
          requestId
        ),
      after: {
        status:
          claimed.status,
        executionStatus:
          claimed.executionStatus,
        executionResult:
          claimed.executionResult,
      },
      metadata: {
        requiredPermission:
          claimed
            .requiredPermission,
        automaticExecution:
          false,
        deliveryTriggered:
          false,
      },
    });

    return {
      proposal:
        claimed,
      preparation,
      idempotent: false,
    };
  } catch (error) {
    claimed.executionStatus =
      "failed";
    claimed.executionBlockedReason =
      "Draft preparation failed. No campaign was scheduled or sent.";
    claimed.executionError =
      text(
        error?.message
      ).slice(
        0,
        1000
      );

    await claimed
      .save()
      .catch(
        () => undefined
      );

    await AuditLog.create({
      actor:
        actorId(
          user
        ),
      action:
        "ai_adviser.proposal_draft_preparation_failed",
      resourceType:
        "AiActionProposal",
      resourceId:
        String(
          claimed._id
        ),
      requestId:
        text(
          requestId
        ),
      after: {
        status:
          claimed.status,
        executionStatus:
          claimed.executionStatus,
      },
      metadata: {
        requiredPermission:
          claimed
            .requiredPermission,
        automaticExecution:
          false,
        deliveryTriggered:
          false,
        errorCode:
          text(
            error?.code
          ),
      },
    }).catch(
      () => undefined
    );

    throw error;
  }
}

export default {
  isAdviserProposalPreparable,
  prepareApprovedAdviserProposal,
  prepareCampaignDraftFromProposal,
};
