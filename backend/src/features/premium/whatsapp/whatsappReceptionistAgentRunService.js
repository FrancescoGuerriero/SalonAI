import mongoose from "mongoose";

import AiAgentRun from "../../aiPlatform/AiAgentRun.js";
import {
  getBuiltinAiAgentDefinition,
} from "../../aiPlatform/aiWorkforceBuiltinAgents.js";
import WhatsAppConversation from "./WhatsAppConversation.js";

function text(value) {
  return String(value ?? "").trim();
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
    requestedAutonomy: "A0",
    effectiveAutonomy: "A0",
    status: "started",
    requestId: text(requestId).slice(0, 160),
    metadata: {
      deterministicBookingAuthority: true,
      directMutationAuthority: false,
      humanHandoffAvailable: true,
    },
  });

  return {
    run,
    agent,
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
  startWhatsAppReceptionistAgentRun,
};
