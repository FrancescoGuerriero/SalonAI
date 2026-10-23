import mongoose from "mongoose";

import AuditLog from "../../../models/AuditLog.js";
import AiActionProposal from "../../aiPlatform/AiActionProposal.js";
import AiAgentRun from "../../aiPlatform/AiAgentRun.js";
import {
  getBuiltinAiAgentDefinition,
} from "../../aiPlatform/aiWorkforceBuiltinAgents.js";
import {
  requireAiWorkforceTool,
} from "../../aiPlatform/aiWorkforceToolRegistry.js";
import WhatsAppConversation from "./WhatsAppConversation.js";

const DEFAULT_PROPOSAL_TTL_MS = 2 * 60 * 60 * 1000;

function text(value) {
  return String(value ?? "").trim();
}

function dateOnly(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

function proposalSpec(conversation, result = {}) {
  const session = conversation?.bookingSession || {};
  const automation = conversation?.automation || {};

  if (
    result.bookingReady === true &&
    automation.handoffReason === "customer_confirmed_slot"
  ) {
    return {
      toolKey: "appointment.create.propose",
      actionType: "appointment.create_review",
      requiredPermission: "appointment:create",
      targetType: "booking_intent",
      targetId: String(conversation._id),
      contextPath: "whatsapp.booking.confirmation",
      summary: "Review customer-confirmed WhatsApp appointment request.",
      rationale:
        "The customer explicitly confirmed the collected slot. The AI Receptionist may propose the booking, but an authorised person must review it and canonical booking services retain mutation authority.",
      proposedChanges: {
        customerId: conversation.customer ? String(conversation.customer) : "",
        serviceId: session.serviceId ? String(session.serviceId) : "",
        stylistId: session.stylistId ? String(session.stylistId) : "",
        appointmentDate: dateOnly(session.appointmentDate),
        appointmentTime: text(session.appointmentTime),
        duration: Number.isFinite(Number(session.duration))
          ? Number(session.duration)
          : null,
        totalPrice: Number.isFinite(Number(session.price))
          ? Number(session.price)
          : null,
        bookingSource: "whatsapp",
      },
    };
  }

  if (
    result.intent === "reschedule" &&
    session.appointmentId
  ) {
    return {
      toolKey: "appointment.reschedule.propose",
      actionType: "appointment.reschedule_review",
      requiredPermission: "appointment:update",
      targetType: "appointment",
      targetId: String(session.appointmentId),
      contextPath: "whatsapp.appointment.reschedule",
      summary: "Review customer WhatsApp reschedule request.",
      rationale:
        "The customer requested a reschedule. The AI Receptionist records the request for authorised review and does not change the Appointment.",
      proposedChanges: {
        requestedDate: dateOnly(session.appointmentDate),
        requestedTime: text(session.appointmentTime),
        requestedStylistId: session.stylistId ? String(session.stylistId) : "",
        reason: "Customer requested reschedule through WhatsApp.",
      },
    };
  }

  if (
    result.intent === "cancellation" &&
    session.appointmentId
  ) {
    return {
      toolKey: "appointment.cancel.propose",
      actionType: "appointment.cancel_review",
      requiredPermission: "appointment:cancel",
      targetType: "appointment",
      targetId: String(session.appointmentId),
      contextPath: "whatsapp.appointment.cancellation",
      summary: "Review customer WhatsApp cancellation request.",
      rationale:
        "The customer requested cancellation. The AI Receptionist records the request for authorised review and does not change the Appointment.",
      proposedChanges: {
        reason: "Customer requested cancellation through WhatsApp.",
      },
    };
  }

  return null;
}

export async function startWhatsAppReceptionistAgentRun({
  conversationId,
  requestId = "",
} = {}) {
  if (!mongoose.isValidObjectId(conversationId)) {
    return {
      run: null,
      skipped: "conversation_id_invalid",
    };
  }

  const conversation = await WhatsAppConversation.findById(conversationId)
    .select("business location customer")
    .lean();

  if (!conversation?.business) {
    // Legacy provider conversations may not yet have canonical tenant binding.
    // They remain operational during the ownership migration, but must not be
    // represented as tenant-scoped AI Workforce evidence until Business is
    // known from a trusted provider-destination binding.
    return {
      run: null,
      skipped: "trusted_business_unavailable",
    };
  }

  const agent = getBuiltinAiAgentDefinition("ai-receptionist");
  const run = await AiAgentRun.create({
    business: conversation.business,
    location: conversation.location || null,
    customer: conversation.customer || null,
    agentKey: agent.key,
    agentVersion: agent.version,
    initiatorType: "customer_channel",
    initiatedBy: null,
    channel: "whatsapp",
    channelConversationRef: String(conversation._id),
    requestedAutonomy: "A1",
    effectiveAutonomy: "A1",
    status: "started",
    requestId: text(requestId).slice(0, 160),
    metadata: {
      deterministicBookingAuthority: true,
      directMutationAuthority: false,
      proposalAuthority: true,
      humanHandoffAvailable: true,
    },
  });

  return {
    run,
    agent,
    skipped: "",
  };
}

export async function proposeWhatsAppReceptionistAppointmentTask({
  conversationId,
  runId,
  result = {},
  requestId = "",
} = {}) {
  if (
    !mongoose.isValidObjectId(conversationId) ||
    !mongoose.isValidObjectId(runId)
  ) {
    return {
      proposal: null,
      skipped: "proposal_context_invalid",
    };
  }

  const conversation = await WhatsAppConversation.findById(conversationId)
    .select("business location customer bookingSession automation status")
    .lean();
  if (!conversation?.business) {
    return {
      proposal: null,
      skipped: "trusted_business_unavailable",
    };
  }

  const run = await AiAgentRun.findOne({
    _id: runId,
    business: conversation.business,
    agentKey: "ai-receptionist",
    initiatorType: "customer_channel",
    channel: "whatsapp",
    channelConversationRef: String(conversation._id),
  });
  if (!run) {
    return {
      proposal: null,
      skipped: "agent_run_unavailable",
    };
  }

  const spec = proposalSpec(conversation, result);
  if (!spec) {
    return {
      proposal: null,
      skipped: "proposal_not_applicable",
    };
  }

  const agent = getBuiltinAiAgentDefinition("ai-receptionist");
  if (agent.autonomyCeiling !== "A1" || !agent.allowedTools.includes(spec.toolKey)) {
    const error = new Error("AI Receptionist is not authorised to propose this appointment task.");
    error.code = "AI_RECEPTIONIST_TOOL_NOT_ALLOWED";
    error.statusCode = 403;
    throw error;
  }
  const tool = requireAiWorkforceTool(spec.toolKey);
  if (
    tool.mutation !== false ||
    tool.requiresHumanApproval !== true ||
    tool.maximumAutonomy !== "A1"
  ) {
    const error = new Error("AI Receptionist appointment tools must remain proposal-only.");
    error.code = "AI_RECEPTIONIST_PROPOSAL_POLICY_INVALID";
    error.statusCode = 500;
    throw error;
  }

  const existing = await AiActionProposal.findOne({
    business: conversation.business,
    agentRun: run._id,
    actionType: spec.actionType,
    targetType: spec.targetType,
    targetId: spec.targetId,
    status: { $in: ["pending", "approved"] },
  });
  if (existing) {
    return {
      proposal: existing,
      skipped: "proposal_already_exists",
    };
  }

  const now = new Date();
  const proposal = await AiActionProposal.create({
    business: conversation.business,
    location: conversation.location || undefined,
    agentRun: run._id,
    agentKey: agent.key,
    autonomyLevel: "A1",
    riskLevel: tool.riskLevel,
    evidenceRefs: [
      `whatsapp-conversation:${conversation._id}`,
      ...(text(requestId) ? [`provider-message:${text(requestId).slice(0, 160)}`] : []),
    ],
    rollbackPlan:
      "No automatic mutation occurs. Rejecting the proposal leaves canonical Appointment state unchanged.",
    initiatorType: "customer_channel",
    createdBy: null,
    customer: conversation.customer || null,
    channel: "whatsapp",
    channelConversationRef: String(conversation._id),
    inferenceId: text(requestId).slice(0, 128),
    actionType: spec.actionType,
    domain: "appointments",
    requiredPermission: spec.requiredPermission,
    targetType: spec.targetType,
    targetId: spec.targetId,
    contextPath: spec.contextPath,
    summary: spec.summary,
    rationale: spec.rationale,
    proposedChanges: spec.proposedChanges,
    status: "pending",
    expiresAt: new Date(now.getTime() + DEFAULT_PROPOSAL_TTL_MS),
    executionStatus: "blocked",
    executionBlockedReason:
      "AI Receptionist proposals require authorised human review and cannot mutate Appointment state automatically.",
  });

  run.proposalIds.addToSet(proposal._id);
  run.toolInvocations.push({
    toolKey: tool.key,
    requiredPermission: tool.requiredPermission,
    riskLevel: tool.riskLevel,
    status: "completed",
    evidenceRefs: proposal.evidenceRefs,
    startedAt: now,
    completedAt: new Date(),
  });
  await run.save();

  await AuditLog.create({
    actor: null,
    action: "ai_workforce.customer_channel_proposal_created",
    resourceType: "AiActionProposal",
    resourceId: String(proposal._id),
    requestId: text(requestId).slice(0, 160),
    after: {
      actionType: proposal.actionType,
      targetType: proposal.targetType,
      targetId: proposal.targetId,
      status: proposal.status,
    },
    metadata: {
      businessId: String(conversation.business),
      locationId: conversation.location ? String(conversation.location) : "",
      customerId: conversation.customer ? String(conversation.customer) : "",
      conversationId: String(conversation._id),
      agentRunId: String(run._id),
      agentKey: agent.key,
      toolKey: tool.key,
      initiatorType: "customer_channel",
      requiredPermission: tool.requiredPermission,
      automaticExecution: false,
    },
  });

  return {
    proposal,
    skipped: "",
  };
}

export async function completeWhatsAppReceptionistAgentRun(
  runId,
  result = {},
  { startedAt = null } = {}
) {
  if (!mongoose.isValidObjectId(runId)) return null;
  const completedAt = new Date();
  const latencyMs = startedAt
    ? Math.max(0, completedAt.getTime() - new Date(startedAt).getTime())
    : null;

  return AiAgentRun.findByIdAndUpdate(
    runId,
    {
      $set: {
        status: "completed",
        completedAt,
        ...(latencyMs !== null ? { latencyMs } : {}),
        modelName: text(result.modelName || result.model_name).slice(0, 160),
        modelVersion: text(result.modelVersion || result.model_version).slice(0, 160),
        "outcome.taskSuccess": result.processed !== false,
        "outcome.policyViolation": false,
        "metadata.intent": text(result.intent).slice(0, 80),
        "metadata.confidence":
          Number.isFinite(Number(result.confidence))
            ? Number(result.confidence)
            : null,
        "metadata.handoff": result.handoff === true,
        "metadata.serviceRequiresConsultation":
          result.serviceRequiresConsultation === true,
        "metadata.providerMode": text(
          result.providerMode || result.provider_mode
        ).slice(0, 80),
        "metadata.proposalId": text(result.aiProposalId).slice(0, 120),
        "metadata.proposalActionType": text(result.aiProposalActionType).slice(0, 160),
      },
    },
    { new: true }
  ).lean();
}

export async function failWhatsAppReceptionistAgentRun(runId, error) {
  if (!mongoose.isValidObjectId(runId)) return null;
  return AiAgentRun.findByIdAndUpdate(
    runId,
    {
      $set: {
        status: "failed",
        completedAt: new Date(),
        "outcome.taskSuccess": false,
        "metadata.errorCode": text(error?.code || error?.name).slice(0, 120),
      },
    },
    { new: true }
  ).lean();
}

export default {
  completeWhatsAppReceptionistAgentRun,
  failWhatsAppReceptionistAgentRun,
  proposeWhatsAppReceptionistAppointmentTask,
  startWhatsAppReceptionistAgentRun,
};
