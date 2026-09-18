import AuditLog from "../../models/AuditLog.js";
import {
  hasUserPermission,
} from "../../middleware/permissionMiddleware.js";
import AiActionProposal from "../aiPlatform/AiActionProposal.js";

const DEFAULT_EXPIRY_MS =
  7 * 24 * 60 * 60 * 1000;
const MAX_PROPOSAL_JSON_BYTES =
  8 * 1024;

const ACTION_SPECS =
  Object.freeze({
    "appointment.reschedule_review":
      Object.freeze({
        domain:
          "appointments",
        requiredPermission:
          "appointment:update",
        targetType:
          "appointment",
        contexts:
          /appointment|calendar|booking/,
        allowedChangeKeys:
          Object.freeze([
            "startsAt",
            "endsAt",
            "stylistId",
            "serviceId",
            "reason",
          ]),
        label:
          "Prepare appointment reschedule for review",
      }),
    "appointment.cancel_review":
      Object.freeze({
        domain:
          "appointments",
        requiredPermission:
          "appointment:cancel",
        targetType:
          "appointment",
        contexts:
          /appointment|calendar|booking/,
        allowedChangeKeys:
          Object.freeze([
            "reason",
          ]),
        label:
          "Prepare appointment cancellation for review",
      }),
    "customer.follow_up_review":
      Object.freeze({
        domain:
          "customers",
        requiredPermission:
          "communications:manage",
        targetType:
          "customer",
        contexts:
          /customer|crm/,
        allowedChangeKeys:
          Object.freeze([
            "channel",
            "templateId",
            "scheduledFor",
            "reason",
          ]),
        label:
          "Prepare customer follow-up for review",
      }),
    "communications.campaign_review":
      Object.freeze({
        domain:
          "communications",
        requiredPermission:
          "communications:manage",
        targetType:
          "campaign",
        contexts:
          /communication|campaign|marketing/,
        allowedChangeKeys:
          Object.freeze([
            "scheduledFor",
            "channel",
            "reason",
          ]),
        label:
          "Prepare campaign change for review",
      }),
    "inventory.restock_review":
      Object.freeze({
        domain:
          "inventory",
        requiredPermission:
          "inventory:manage",
        targetType:
          "product",
        contexts:
          /product|inventory|shop/,
        allowedChangeKeys:
          Object.freeze([
            "quantity",
            "supplierId",
            "reason",
          ]),
        label:
          "Prepare inventory restock for review",
      }),
    "service.catalogue_review":
      Object.freeze({
        domain:
          "services",
        requiredPermission:
          "service:update",
        targetType:
          "service",
        contexts:
          /service/,
        allowedChangeKeys:
          Object.freeze([
            "price",
            "duration",
            "onlineBookable",
            "reason",
          ]),
        label:
          "Prepare service catalogue change for review",
      }),
  });

const FORBIDDEN_KEYS =
  new Set([
    "password",
    "passwordhash",
    "token",
    "accesstoken",
    "refreshtoken",
    "secret",
    "email",
    "phone",
    "mobile",
    "alternativphone",
    "alternativephone",
    "internalnotes",
    "consultationnotes",
    "hairprofile",
    "medical",
    "medicalnotes",
  ]);

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function lower(
  value
) {
  return text(
    value
  ).toLowerCase();
}

function actorId(
  user
) {
  return (
    user?._id ||
    user?.id ||
    null
  );
}

function proposalError(
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

function actionSpec(
  actionType
) {
  const type =
    text(
      actionType
    );
  const spec =
    ACTION_SPECS[
      type
    ];

  if (!spec) {
    throw proposalError(
      "Unsupported SalonAI Adviser proposal type.",
      400,
      "AI_ACTION_PROPOSAL_TYPE_UNSUPPORTED"
    );
  }

  return {
    type,
    spec,
  };
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
    throw proposalError(
      "You do not have permission to propose or approve this action.",
      403,
      "AI_ACTION_PROPOSAL_PERMISSION_REQUIRED"
    );
  }
}

function assertPlainObject(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return {};
  }

  if (
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw proposalError(
      "proposedChanges must be an object.",
      400,
      "AI_ACTION_PROPOSAL_CHANGES_INVALID"
    );
  }

  return value;
}

function normaliseChangeValue(
  value,
  depth = 0
) {
  if (
    depth >
    3
  ) {
    throw proposalError(
      "proposedChanges is too deeply nested.",
      400,
      "AI_ACTION_PROPOSAL_CHANGES_INVALID"
    );
  }

  if (
    value === null ||
    typeof value ===
      "boolean" ||
    typeof value ===
      "number"
  ) {
    return value;
  }

  if (
    typeof value ===
      "string"
  ) {
    return value
      .trim()
      .slice(
        0,
        1000
      );
  }

  if (
    Array.isArray(
      value
    )
  ) {
    if (
      value.length >
      50
    ) {
      throw proposalError(
        "proposedChanges contains too many values.",
        400,
        "AI_ACTION_PROPOSAL_CHANGES_INVALID"
      );
    }

    return value.map(
      (item) =>
        normaliseChangeValue(
          item,
          depth + 1
        )
    );
  }

  if (
    typeof value ===
      "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value
      ).map(
        ([
          key,
          item,
        ]) => {
          if (
            FORBIDDEN_KEYS.has(
              lower(
                key
              ).replace(
                /[^a-z0-9]/g,
                ""
              )
            )
          ) {
            throw proposalError(
              `Sensitive field ${key} cannot be stored in an Adviser action proposal.`,
              400,
              "AI_ACTION_PROPOSAL_SENSITIVE_DATA_REJECTED"
            );
          }

          return [
            key,
            normaliseChangeValue(
              item,
              depth + 1
            ),
          ];
        }
      )
    );
  }

  throw proposalError(
    "proposedChanges contains an unsupported value.",
    400,
    "AI_ACTION_PROPOSAL_CHANGES_INVALID"
  );
}

export function sanitiseProposalChanges({
  actionType,
  proposedChanges,
}) {
  const {
    spec,
  } =
    actionSpec(
      actionType
    );
  const input =
    assertPlainObject(
      proposedChanges
    );
  const allowed =
    new Set(
      spec
        .allowedChangeKeys
    );

  for (
    const key of
    Object.keys(
      input
    )
  ) {
    if (
      !allowed.has(
        key
      )
    ) {
      throw proposalError(
        `Field ${key} is not allowed for ${actionType} proposals.`,
        400,
        "AI_ACTION_PROPOSAL_FIELD_NOT_ALLOWED"
      );
    }
  }

  const safe =
    normaliseChangeValue(
      input
    );
  const serialised =
    JSON.stringify(
      safe
    );

  if (
    Buffer.byteLength(
      serialised,
      "utf8"
    ) >
    MAX_PROPOSAL_JSON_BYTES
  ) {
    throw proposalError(
      "proposedChanges is too large.",
      400,
      "AI_ACTION_PROPOSAL_CHANGES_TOO_LARGE"
    );
  }

  return safe;
}

export function suggestAdviserActions({
  contextPath = "",
  user,
} = {}) {
  const currentPath =
    lower(
      contextPath
    );

  return Object.entries(
    ACTION_SPECS
  )
    .filter(
      ([
        ,
        spec,
      ]) =>
        spec.contexts.test(
          currentPath
        ) &&
        hasUserPermission(
          user,
          spec.requiredPermission
        )
    )
    .map(
      ([
        type,
        spec,
      ]) => ({
        actionType:
          type,
        domain:
          spec.domain,
        label:
          spec.label,
        requiredPermission:
          spec.requiredPermission,
        targetType:
          spec.targetType,
        requiresHumanApproval:
          true,
        automaticExecution:
          false,
      })
    );
}

export async function createAdviserActionProposal({
  inferenceId = "",
  actionType,
  targetType,
  targetId,
  contextPath = "",
  summary,
  rationale = "",
  proposedChanges = {},
  user,
  requestId = "",
} = {}) {
  const {
    type,
    spec,
  } =
    actionSpec(
      actionType
    );

  assertPermission(
    user,
    spec.requiredPermission
  );

  if (
    text(
      targetType
    ) !==
    spec.targetType
  ) {
    throw proposalError(
      `Target type must be ${spec.targetType} for this proposal.`,
      400,
      "AI_ACTION_PROPOSAL_TARGET_INVALID"
    );
  }

  const safeTargetId =
    text(
      targetId
    );

  if (
    !safeTargetId ||
    safeTargetId.length >
      256
  ) {
    throw proposalError(
      "A valid proposal target identifier is required.",
      400,
      "AI_ACTION_PROPOSAL_TARGET_INVALID"
    );
  }

  const safeSummary =
    text(
      summary
    );

  if (
    safeSummary.length <
      3 ||
    safeSummary.length >
      300
  ) {
    throw proposalError(
      "Proposal summary must contain between 3 and 300 characters.",
      400,
      "AI_ACTION_PROPOSAL_SUMMARY_INVALID"
    );
  }

  const changes =
    sanitiseProposalChanges({
      actionType:
        type,
      proposedChanges,
    });
  const now =
    new Date();

  const proposal =
    await AiActionProposal.create({
      createdBy:
        actorId(
          user
        ),
      inferenceId:
        text(
          inferenceId
        ).slice(
          0,
          128
        ),
      actionType:
        type,
      domain:
        spec.domain,
      requiredPermission:
        spec.requiredPermission,
      targetType:
        spec.targetType,
      targetId:
        safeTargetId,
      contextPath:
        text(
          contextPath
        ).slice(
          0,
          500
        ),
      summary:
        safeSummary,
      rationale:
        text(
          rationale
        ).slice(
          0,
          2000
        ),
      proposedChanges:
        changes,
      status:
        "pending",
      expiresAt:
        new Date(
          now.getTime() +
            DEFAULT_EXPIRY_MS
        ),
      executionStatus:
        "blocked",
    });

  await AuditLog.create({
    actor:
      actorId(
        user
      ),
    action:
      "ai_adviser.proposal_created",
    resourceType:
      "AiActionProposal",
    resourceId:
      String(
        proposal._id
      ),
    requestId:
      text(
        requestId
      ),
    after: {
      actionType:
        proposal.actionType,
      targetType:
        proposal.targetType,
      targetId:
        proposal.targetId,
      status:
        proposal.status,
    },
    metadata: {
      requiredPermission:
        proposal.requiredPermission,
      automaticExecution:
        false,
    },
  });

  return proposal;
}

function statusFilter(
  value
) {
  const status =
    lower(
      value
    );

  if (!status) {
    return null;
  }

  if (
    ![
      "pending",
      "approved",
      "rejected",
      "expired",
    ].includes(
      status
    )
  ) {
    throw proposalError(
      "Invalid Adviser proposal status filter.",
      400,
      "AI_ACTION_PROPOSAL_STATUS_INVALID"
    );
  }

  return status;
}

export async function listAdviserActionProposals({
  user,
  status = "",
  limit = 50,
} = {}) {
  const selectedStatus =
    statusFilter(
      status
    );
  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Number(
          limit
        ) || 50
      )
    );
  const query =
    selectedStatus
      ? {
          status:
            selectedStatus,
        }
      : {};

  const proposals =
    await AiActionProposal.find(
      query
    )
      .sort({
        createdAt: -1,
      })
      .limit(
        safeLimit * 3
      )
      .lean();

  const currentActor =
    String(
      actorId(
        user
      ) || ""
    );

  return proposals
    .filter(
      (proposal) =>
        String(
          proposal.createdBy
        ) ===
          currentActor ||
        hasUserPermission(
          user,
          proposal.requiredPermission
        )
    )
    .slice(
      0,
      safeLimit
    );
}

export async function reviewAdviserActionProposal({
  proposalId,
  decision,
  note = "",
  user,
  requestId = "",
} = {}) {
  const selectedDecision =
    lower(
      decision
    );

  if (
    ![
      "approved",
      "rejected",
    ].includes(
      selectedDecision
    )
  ) {
    throw proposalError(
      "Proposal decision must be approved or rejected.",
      400,
      "AI_ACTION_PROPOSAL_DECISION_INVALID"
    );
  }

  const proposal =
    await AiActionProposal.findById(
      proposalId
    );

  if (!proposal) {
    throw proposalError(
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
      "pending"
  ) {
    throw proposalError(
      "Only pending Adviser proposals can be reviewed.",
      409,
      "AI_ACTION_PROPOSAL_NOT_PENDING"
    );
  }

  const now =
    new Date();

  if (
    proposal.expiresAt &&
    new Date(
      proposal.expiresAt
    ) <= now
  ) {
    proposal.status =
      "expired";
    await proposal.save();

    throw proposalError(
      "This Adviser proposal has expired.",
      409,
      "AI_ACTION_PROPOSAL_EXPIRED"
    );
  }

  const before = {
    status:
      proposal.status,
    executionStatus:
      proposal
        .executionStatus,
  };

  proposal.status =
    selectedDecision;
  proposal.reviewedBy =
    actorId(
      user
    );
  proposal.reviewedAt =
    now;
  proposal.reviewNote =
    text(
      note
    ).slice(
      0,
      1000
    );
  proposal.executionStatus =
    "blocked";
  proposal.executionBlockedReason =
    selectedDecision ===
    "approved"
      ? "Human approval is recorded. No automatic Adviser executor is enabled; execute the business change through its governed SalonAI workflow."
      : "Proposal was rejected and cannot be executed.";

  await proposal.save();

  await AuditLog.create({
    actor:
      actorId(
        user
      ),
    action:
      `ai_adviser.proposal_${selectedDecision}`,
    resourceType:
      "AiActionProposal",
    resourceId:
      String(
        proposal._id
      ),
    requestId:
      text(
        requestId
      ),
    before,
    after: {
      status:
        proposal.status,
      executionStatus:
        proposal
          .executionStatus,
    },
    metadata: {
      requiredPermission:
        proposal
          .requiredPermission,
      automaticExecution:
        false,
    },
  });

  return proposal;
}

export default {
  createAdviserActionProposal,
  listAdviserActionProposals,
  reviewAdviserActionProposal,
  sanitiseProposalChanges,
  suggestAdviserActions,
};
