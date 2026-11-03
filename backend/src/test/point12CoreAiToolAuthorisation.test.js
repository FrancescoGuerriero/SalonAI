import assert from "node:assert/strict";
import test from "node:test";
import { authoriseCoreAiTool, assertCoreAiToolDecision } from "../platform/coreAi/coreAiToolAuthorisation.js";

function check({ agentKey = "business-adviser", toolKey = "business.metrics.read", autonomy = "A0", mutate = null } = {}) {
  const context = Object.freeze({
    businessId: "business-a",
    userId: "user-a",
    moduleKey: "ai-decision-support",
    toolKey: "business-adviser",
    locationId: "location-a",
    manifestRevision: "7",
    externalWritesAllowed: false,
  });
  const request = {
    coreAiExecutionContext: context,
    effectiveAuthority: {
      businessId: "business-a",
      userId: "user-a",
      permissions: ["ai:use"],
    },
    commercialModuleEntitlement: {
      businessId: "business-a",
      moduleKey: "ai-decision-support",
      verticalId: "salon",
    },
  };
  if (mutate) mutate(request);
  let nextCalled = false;
  let nextError;
  authoriseCoreAiTool({ agentKey, toolKey, requestedAutonomy: autonomy })(
    request, {}, (error) => {
      nextCalled = true;
      nextError = error || null;
    }
  );
  assert.equal(nextCalled, true);
  return { request, error: nextError };
}

test("registered read-only Adviser metric tool is permitted with immutable audit decision", () => {
  const { request, error } = check();
  assert.equal(error, null);
  assert.equal(request.coreAiToolDecision.toolKey, "business.metrics.read");
  assert.equal(request.coreAiToolDecision.businessId, "business-a");
  assert.equal(request.coreAiToolDecision.autonomy, "A0");
  assert.equal(request.coreAiToolDecision.mutation, false);
  assert.equal(request.coreAiToolDecision.auditRequired, true);
  assert.equal(Object.isFrozen(request.coreAiToolDecision), true);
});

test("deny mismatched Business, missing context or user permission", () => {
  assert.equal(check({ mutate: r => { r.commercialModuleEntitlement.businessId = "business-b"; } }).error?.code, "CORE_AI_TOOL_CONTEXT_REQUIRED");
  assert.equal(check({ mutate: r => { r.coreAiExecutionContext = null; } }).error?.code, "CORE_AI_TOOL_CONTEXT_REQUIRED");
  assert.equal(check({ mutate: r => { r.effectiveAuthority.permissions = []; } }).error?.code, "CORE_AI_TOOL_PERMISSION_REQUIRED");
  assert.equal(check({ mutate: r => { r.coreAiExecutionContext = Object.freeze({...r.coreAiExecutionContext, externalWritesAllowed: true}); } }).error?.code, "CORE_AI_TOOL_CONTEXT_REQUIRED");
});

test("deny unregistered and agent-unapproved tools", () => {
  assert.equal(check({ toolKey: "unknown.tool" }).error?.code, "AI_TOOL_NOT_REGISTERED");
  assert.equal(check({ toolKey: "availability.search" }).error?.code, "CORE_AI_TOOL_PERMISSION_REQUIRED");
  assert.equal(
    check({
      toolKey: "availability.search",
      mutate: r => { r.effectiveAuthority.permissions.push("appointment:read"); },
    }).error?.code,
    "AI_AGENT_TOOL_NOT_ALLOWED"
  );
});

test("deny unsupported vertical and autonomy elevation", () => {
  assert.equal(check({ mutate: r => { r.commercialModuleEntitlement.verticalId = "fitness"; } }).error?.code, "CORE_AI_TOOL_VERTICAL_UNAVAILABLE");
  assert.equal(check({ autonomy: "A2" }).error?.code, "AI_AUTONOMY_NOT_ACTIVATED");
});

test("deny approval-gated proposal tools even if request claims approval", () => {
  assert.equal(
    check({
      agentKey: "ai-receptionist",
      toolKey: "appointment.create.propose",
      autonomy: "A1",
      mutate: r => {
        r.coreAiExecutionContext = Object.freeze({
          ...r.coreAiExecutionContext, toolKey: "ai-receptionist"
        });
        r.commercialModuleEntitlement.moduleKey = "ai-receptionist";
        r.coreAiExecutionContext = Object.freeze({
          ...r.coreAiExecutionContext, moduleKey: "ai-receptionist"
        });
        r.effectiveAuthority.permissions.push("appointment:create");
        r.coreAiApprovedProposal = true;
      },
    }).error?.code,
    "CORE_AI_TOOL_APPROVAL_REQUIRED"
  );
});

test("deny missing agent/tool configuration before any execution", () => {
  assert.throws(() => authoriseCoreAiTool({ agentKey: "business-adviser" }), { code: "CORE_AI_TOOL_CONFIGURATION_REQUIRED" });
});

test("downstream Adviser service requires exact frozen tool decision and execution scope", () => {
  const { request, error } = check();
  assert.equal(error, null);
  const args = {
    decision: request.coreAiToolDecision,
    context: request.coreAiExecutionContext,
    agentKey: "business-adviser",
    toolKey: "business.metrics.read",
  };
  assert.equal(assertCoreAiToolDecision(args), request.coreAiToolDecision);
  assert.throws(() => assertCoreAiToolDecision({ ...args, decision: null }), { code: "CORE_AI_TOOL_DECISION_REQUIRED" });
  assert.throws(() => assertCoreAiToolDecision({
    ...args,
    decision: Object.freeze({ ...args.decision, businessId: "business-b" }),
  }), { code: "CORE_AI_TOOL_DECISION_REQUIRED" });
  assert.throws(() => assertCoreAiToolDecision({
    ...args,
    decision: Object.freeze({ ...args.decision, moduleKey: "ai-retention" }),
  }), { code: "CORE_AI_TOOL_DECISION_REQUIRED" });
  assert.throws(() => assertCoreAiToolDecision({
    ...args,
    decision: { ...args.decision },
  }), { code: "CORE_AI_TOOL_DECISION_REQUIRED" });
});

test("Adviser controller and service propagate policy decision into persistent AgentRun metadata", async () => {
  const { readFile } = await import("node:fs/promises");
  const [controller, service] = await Promise.all([
    readFile(new URL("../features/aiRecommendations/aiAdviserController.js", import.meta.url), "utf8"),
    readFile(new URL("../features/aiRecommendations/aiAdviserService.js", import.meta.url), "utf8"),
  ]);
  assert.match(controller, /coreAiExecutionContext: executionContext/);
  assert.match(controller, /coreAiToolDecision: toolDecision/);
  assert.match(service, /assertCoreAiToolDecision\(/);
  assert.match(service, /CORE_AI_TOOL_SCOPE_MISMATCH/);
  assert.match(service, /coreAiToolDecision: \{/);
  assert.match(service, /await AiAgentRun\.create\(/);
  assert.match(service, /await AiAgentRun\.updateOne\(/);
});
