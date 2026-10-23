import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import AiAgentRun from "../features/aiPlatform/AiAgentRun.js";
import {
  getBuiltinAiAgentDefinition,
} from "../features/aiPlatform/aiWorkforceBuiltinAgents.js";
import {
  requireAiWorkforceTool,
} from "../features/aiPlatform/aiWorkforceToolRegistry.js";

const BUSINESS_ID = "507f1f77bcf86cd799439021";
const CUSTOMER_ID = "507f1f77bcf86cd799439023";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("AI Receptionist is registered at A0 with read-only tools", () => {
  const agent = getBuiltinAiAgentDefinition("ai-receptionist");

  assert.equal(agent.autonomyCeiling, "A0");
  assert.deepEqual(agent.allowedTools, [
    "service.catalogue.read",
    "availability.search",
  ]);

  for (const key of agent.allowedTools) {
    const tool = requireAiWorkforceTool(key);
    assert.equal(tool.mutation, false);
    assert.equal(tool.maximumAutonomy, "A0");
  }
});

test("customer-channel AgentRun has explicit provenance without fake staff user", async () => {
  const run = new AiAgentRun({
    business: BUSINESS_ID,
    customer: CUSTOMER_ID,
    agentKey: "ai-receptionist",
    agentVersion: "1",
    initiatorType: "customer_channel",
    initiatedBy: null,
    channel: "whatsapp",
    channelConversationRef: "507f1f77bcf86cd799439025",
    requestedAutonomy: "A0",
    effectiveAutonomy: "A0",
  });

  await assert.doesNotReject(run.validate());
  assert.equal(run.initiatedBy, null);
});

test("default WhatsApp bot runtime wraps AI analysis with Workforce provenance only", async () => {
  const [runtime, provenance] = await Promise.all([
    source("../features/premium/whatsapp/whatsappBotRuntime.js"),
    source("../features/premium/whatsapp/whatsappReceptionistAgentRunService.js"),
  ]);

  assert.match(runtime, /processMessage ===[\s\S]*processWhatsAppBotMessage/);
  assert.match(runtime, /startWhatsAppReceptionistAgentRun/);
  assert.match(runtime, /aiWorkforceAutonomy:[\s\S]*"A0"/);
  assert.match(provenance, /trusted_business_unavailable/);
  assert.match(provenance, /directMutationAuthority:[\s\S]*false/);
  assert.match(provenance, /initiatorType:[\s\S]*"customer_channel"/);
});

test("Receptionist integration does not replace canonical consultation or booking authority", async () => {
  const runtime = await source(
    "../features/premium/whatsapp/whatsappBotRuntime.js"
  );
  const orchestrator = await source(
    "../features/premium/whatsapp/whatsappBotOrchestrator.js"
  );

  assert.match(runtime, /processActiveWhatsAppConsultationTurn/);
  assert.match(runtime, /startWhatsAppConsultationFromConversation/);
  assert.match(orchestrator, /buildAvailableSlots/);
  assert.doesNotMatch(runtime, /Appointment\.create|createManagedAppointment/);
});
