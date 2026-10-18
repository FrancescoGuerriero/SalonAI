import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  getBuiltinAiAgentDefinition,
} from "../features/aiPlatform/aiWorkforceBuiltinAgents.js";
import {
  evaluateAgentToolPolicy,
} from "../features/aiPlatform/aiWorkforcePolicy.js";
import {
  requireAiWorkforceTool,
} from "../features/aiPlatform/aiWorkforceToolRegistry.js";


test("built-in Business Adviser is active at A0 with metrics-read tool only", () => {
  const agent =
    getBuiltinAiAgentDefinition(
      "business-adviser"
    );

  assert.equal(
    agent.lifecycle,
    "active"
  );
  assert.equal(
    agent.autonomyCeiling,
    "A0"
  );
  assert.deepEqual(
    agent.allowedTools,
    [
      "business.metrics.read",
    ]
  );

  const policy =
    evaluateAgentToolPolicy({
      agent,
      tool:
        requireAiWorkforceTool(
          "business.metrics.read"
        ),
      requestedAutonomy:
        "A0",
    });

  assert.equal(
    policy.allowed,
    true
  );
  assert.equal(
    policy.directMutation,
    false
  );
});


test("management metric service scopes Appointment occurrence query before aggregation", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiManagementCopilotService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /buildAiTenantFilter/
  );
  assert.match(
    source,
    /Appointment\.find\(\{[\s\S]*?\.\.\.tenantFilter[\s\S]*?\$or:[\s\S]*?startsAt:[\s\S]*?appointmentDate:/
  );
  assert.doesNotMatch(
    source,
    /Appointment\.find\(\{[\s\S]*?createdAt:[\s\S]*?\$gte/
  );
  assert.match(
    source,
    /tenantScoped: true/
  );
});


test("Business Adviser uses registered A0 tool and records tenant AgentRun and inference provenance", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /AGENT_KEY\s*=\s*[\s\S]*?"business-adviser"/
  );
  assert.match(
    source,
    /TOOL_KEY\s*=\s*[\s\S]*?"business\.metrics\.read"/
  );
  assert.match(
    source,
    /evaluateAgentToolPolicy\([\s\S]*?requestedAutonomy:[\s\S]*?"A0"/
  );
  assert.match(
    source,
    /AiAgentRun\.create\(\{[\s\S]*?business:[\s\S]*?payload\.scope[\s\S]*?initiatedBy:[\s\S]*?user\._id/
  );
  assert.match(
    source,
    /AiInferenceLog\.create\(\{[\s\S]*?business:[\s\S]*?payload\.scope[\s\S]*?capability:[\s\S]*?"management-adviser"/
  );
  assert.match(
    source,
    /suggestedActions:\s*\[\]/
  );
});


test("Business Adviser A0 explicitly omits domains that are not yet tenant-safe", async () => {
  const source =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiAdviserService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /omittedUnsafeDomains/
  );
  assert.match(
    source,
    /knowledge-retrieval/
  );
  assert.doesNotMatch(
    source,
    /AiKnowledgeDocument\.find/
  );
  assert.doesNotMatch(
    source,
    /buildAdviserDomainContext\(/
  );
});
