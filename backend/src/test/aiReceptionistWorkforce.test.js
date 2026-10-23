import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import AiActionProposal from "../features/aiPlatform/AiActionProposal.js";
import AiAgentRun from "../features/aiPlatform/AiAgentRun.js";
import {
  getBuiltinAiAgentDefinition,
} from "../features/aiPlatform/aiWorkforceBuiltinAgents.js";
import {
  requireAiWorkforceTool,
} from "../features/aiPlatform/aiWorkforceToolRegistry.js";

const BUSINESS_ID = "507f1f77bcf86cd799439021";
const CUSTOMER_ID = "507f1f77bcf86cd799439023";
const RUN_ID = "507f1f77bcf86cd799439024";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("AI Receptionist is registered at A1 with read and proposal-only tools", () => {
  const agent = getBuiltinAiAgentDefinition("ai-receptionist");

  assert.equal(agent.version, "2");
  assert.equal(agent.autonomyCeiling, "A1");
  assert.deepEqual(agent.allowedTools, [
    "service.catalogue.read",
    "availability.search",
    "appointment.create.propose",
    "appointment.reschedule.propose",
    "appointment.cancel.propose",
  ]);

  for (const key of ["service.catalogue.read", "availability.search"]) {
    const tool = requireAiWorkforceTool(key);
    assert.equal(tool.mutation, false);
    assert.equal(tool.maximumAutonomy, "A0");
    assert.equal(tool.requiresHumanApproval, false);
  }

  for (const key of [
    "appointment.create.propose",
    "appointment.reschedule.propose",
    "appointment.cancel.propose",
  ]) {
    const tool = requireAiWorkforceTool(key);
    assert.equal(tool.mutation, false);
    assert.equal(tool.maximumAutonomy, "A1");
    assert.equal(tool.requiresHumanApproval, true);
  }
});

test("customer-channel AgentRun has explicit A1 provenance without fake staff user", async () => {
  const run = new AiAgentRun({
    business: BUSINESS_ID,
    customer: CUSTOMER_ID,
    agentKey: "ai-receptionist",
    agentVersion: "2",
    initiatorType: "customer_channel",
    initiatedBy: null,
    channel: "whatsapp",
    channelConversationRef: "507f1f77bcf86cd799439025",
    requestedAutonomy: "A1",
    effectiveAutonomy: "A1",
  });

  await assert.doesNotReject(run.validate());
  assert.equal(run.initiatedBy, null);
});

test("customer-channel ActionProposal records channel provenance without fake staff creator", async () => {
  const proposal = new AiActionProposal({
    business: BUSINESS_ID,
    agentRun: RUN_ID,
    agentKey: "ai-receptionist",
    autonomyLevel: "A1",
    riskLevel: "medium",
    initiatorType: "customer_channel",
    createdBy: null,
    customer: CUSTOMER_ID,
    channel: "whatsapp",
    channelConversationRef: "507f1f77bcf86cd799439025",
    actionType: "appointment.create_review",
    domain: "appointments",
    requiredPermission: "appointment:create",
    targetType: "booking_intent",
    targetId: "507f1f77bcf86cd799439025",
    summary: "Review customer-confirmed WhatsApp appointment request.",
    proposedChanges: {
      serviceId: "507f1f77bcf86cd799439026",
      stylistId: "507f1f77bcf86cd799439027",
      appointmentDate: "2026-11-01",
      appointmentTime: "14:00",
    },
    expiresAt: new Date(Date.now() + 60_000),
  });

  await assert.doesNotReject(proposal.validate());
  assert.equal(proposal.createdBy, null);
  assert.equal(proposal.initiatorType, "customer_channel");
});

test("default WhatsApp bot runtime records Workforce A1 proposal provenance without direct mutation", async () => {
  const [runtime, provenance] = await Promise.all([
    source("../features/premium/whatsapp/whatsappBotRuntime.js"),
    source("../features/premium/whatsapp/whatsappReceptionistAgentRunService.js"),
  ]);

  assert.match(runtime, /processMessage ===[\s\S]*processWhatsAppBotMessage/);
  assert.match(runtime, /startWhatsAppReceptionistAgentRun/);
  assert.match(runtime, /proposeWhatsAppReceptionistAppointmentTask/);
  assert.match(runtime, /aiWorkforceAutonomy:[\s\S]*"A1"/);
  assert.match(provenance, /trusted_business_unavailable/);
  assert.match(provenance, /directMutationAuthority:[\s\S]*false/);
  assert.match(provenance, /proposalAuthority:[\s\S]*true/);
  assert.match(provenance, /initiatorType:[\s\S]*"customer_channel"/);
  assert.match(provenance, /appointment\.create_review/);
  assert.match(provenance, /appointment:create/);
  assert.match(provenance, /automaticExecution:[\s\S]*false/);
});

test("Receptionist A1 proposal integration does not replace canonical consultation or booking authority", async () => {
  const runtime = await source(
    "../features/premium/whatsapp/whatsappBotRuntime.js"
  );
  const orchestrator = await source(
    "../features/premium/whatsapp/whatsappBotOrchestrator.js"
  );
  const provenance = await source(
    "../features/premium/whatsapp/whatsappReceptionistAgentRunService.js"
  );

  assert.match(runtime, /processActiveWhatsAppConsultationTurn/);
  assert.match(runtime, /startWhatsAppConsultationFromConversation/);
  assert.match(orchestrator, /buildAvailableSlots/);
  assert.match(orchestrator, /customer_confirmed_slot/);
  assert.doesNotMatch(runtime, /Appointment\.create|createManagedAppointment/);
  assert.doesNotMatch(provenance, /Appointment\.create|createManagedAppointment/);
});
