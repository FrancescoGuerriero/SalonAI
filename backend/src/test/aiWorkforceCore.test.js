import assert from "node:assert/strict";
import test from "node:test";

import AiActionProposal from "../features/aiPlatform/AiActionProposal.js";
import AiAgentDefinition from "../features/aiPlatform/AiAgentDefinition.js";
import AiAgentRun from "../features/aiPlatform/AiAgentRun.js";
import {
  autonomyAtMost,
  evaluateAgentToolPolicy,
} from "../features/aiPlatform/aiWorkforcePolicy.js";
import {
  requireAiWorkforceTool,
} from "../features/aiPlatform/aiWorkforceToolRegistry.js";
import {
  validateAgentDefinitionContract,
} from "../features/aiPlatform/aiWorkforceRegistryService.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439021";
const USER_ID =
  "507f1f77bcf86cd799439024";

test("AI Workforce autonomy ordering is explicit", () => {
  assert.equal(
    autonomyAtMost(
      "A0",
      "A1"
    ),
    true
  );
  assert.equal(
    autonomyAtMost(
      "A2",
      "A1"
    ),
    false
  );
});

test("AI Workforce blocks unregistered tools", () => {
  assert.throws(
    () =>
      requireAiWorkforceTool(
        "database.unrestricted.write"
      ),
    /registered tools only/
  );
});

test("active agent definitions are currently limited to A0/A1", () => {
  assert.throws(
    () =>
      validateAgentDefinitionContract({
        key:
          "dangerous-agent",
        version: "1",
        lifecycle:
          "active",
        autonomyCeiling:
          "A2",
        allowedTools: [],
      }),
    /currently activated Workforce autonomy ceiling/
  );
});

test("registered tool must be explicitly granted to the agent", () => {
  const tool =
    requireAiWorkforceTool(
      "business.metrics.read"
    );

  assert.throws(
    () =>
      evaluateAgentToolPolicy({
        agent: {
          lifecycle:
            "active",
          allowedTools: [],
          autonomyCeiling:
            "A1",
        },
        tool,
        requestedAutonomy:
          "A0",
      }),
    /not granted/
  );
});

test("A0 read tool is allowed only inside both agent and tool ceilings", () => {
  const tool =
    requireAiWorkforceTool(
      "business.metrics.read"
    );
  const result =
    evaluateAgentToolPolicy({
      agent: {
        lifecycle:
          "active",
        allowedTools: [
          tool.key,
        ],
        autonomyCeiling:
          "A1",
      },
      tool,
      requestedAutonomy:
        "A0",
    });

  assert.equal(
    result.allowed,
    true
  );
  assert.equal(
    result.directMutation,
    false
  );
  assert.equal(
    result.requiresHumanApproval,
    false
  );
});

test("A1 proposal tool requires human approval", () => {
  const tool =
    requireAiWorkforceTool(
      "appointment.reschedule.propose"
    );
  const result =
    evaluateAgentToolPolicy({
      agent: {
        lifecycle:
          "active",
        allowedTools: [
          tool.key,
        ],
        autonomyCeiling:
          "A1",
      },
      tool,
      requestedAutonomy:
        "A1",
    });

  assert.equal(
    result.allowed,
    true
  );
  assert.equal(
    result.requiresHumanApproval,
    true
  );
});

test("AgentRun requires tenant and authenticated actor provenance", async () => {
  const run =
    new AiAgentRun({
      business:
        BUSINESS_ID,
      agentKey:
        "business-adviser",
      agentVersion: "1",
      initiatedBy:
        USER_ID,
      requestedAutonomy:
        "A0",
      effectiveAutonomy:
        "A0",
    });

  await assert.doesNotReject(
    run.validate()
  );

  const invalid =
    new AiAgentRun({
      agentKey:
        "business-adviser",
      agentVersion: "1",
      initiatedBy:
        USER_ID,
    });

  await assert.rejects(
    invalid.validate(),
    /business/
  );
});

test("Agent Definition registry supports versioned tools and evaluation metadata", async () => {
  const agent =
    new AiAgentDefinition({
      key:
        "business-adviser",
      version: "1",
      displayName:
        "AI Business Adviser",
      purpose:
        "Explain authorised business metrics and prepare evidence-backed recommendations.",
      lifecycle:
        "draft",
      allowedTools: [
        "business.metrics.read",
      ],
      autonomyCeiling:
        "A0",
      evaluationSuite: {
        key:
          "business-adviser-v1",
        minimumTaskSuccessRate:
          0.9,
      },
    });

  await assert.doesNotReject(
    agent.validate()
  );
});

test("existing ActionProposal is extended rather than duplicated for Workforce provenance", () => {
  assert.ok(
    AiActionProposal.schema.path(
      "business"
    )
  );
  assert.ok(
    AiActionProposal.schema.path(
      "agentRun"
    )
  );
  assert.ok(
    AiActionProposal.schema.path(
      "autonomyLevel"
    )
  );
  assert.ok(
    AiActionProposal.schema.path(
      "evidenceRefs"
    )
  );
  assert.ok(
    AiActionProposal.schema.path(
      "rollbackPlan"
    )
  );
  assert.equal(
    AiActionProposal.schema.path(
      "executionStatus"
    ).defaultValue,
    "blocked"
  );
});
