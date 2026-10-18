export const AI_AUTONOMY_LEVELS =
  Object.freeze([
    "A0",
    "A1",
    "A2",
    "A3",
    "A4",
  ]);

const AUTONOMY_RANK =
  Object.freeze(
    Object.fromEntries(
      AI_AUTONOMY_LEVELS.map(
        (level, index) => [
          level,
          index,
        ]
      )
    )
  );

export const AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING =
  "A1";

export function normaliseAutonomyLevel(
  value,
  fallback = "A0"
) {
  const level =
    String(
      value ||
      fallback
    )
      .trim()
      .toUpperCase();

  if (
    !Object.hasOwn(
      AUTONOMY_RANK,
      level
    )
  ) {
    const error = new Error(
      "Unknown AI Workforce autonomy level."
    );
    error.code =
      "AI_AUTONOMY_LEVEL_INVALID";
    throw error;
  }

  return level;
}

export function autonomyAtMost(
  requested,
  ceiling
) {
  const requestedLevel =
    normaliseAutonomyLevel(
      requested
    );
  const ceilingLevel =
    normaliseAutonomyLevel(
      ceiling
    );

  return (
    AUTONOMY_RANK[
      requestedLevel
    ] <=
    AUTONOMY_RANK[
      ceilingLevel
    ]
  );
}

function policyError(
  message,
  code
) {
  const error =
    new Error(message);
  error.code = code;
  error.statusCode = 403;
  return error;
}

export function evaluateAgentToolPolicy({
  agent,
  tool,
  requestedAutonomy = "A0",
} = {}) {
  if (
    !agent ||
    agent.lifecycle !==
      "active"
  ) {
    throw policyError(
      "The requested AI agent is not active.",
      "AI_AGENT_NOT_ACTIVE"
    );
  }

  if (!tool?.key) {
    throw policyError(
      "AI agents may call registered tools only.",
      "AI_TOOL_NOT_REGISTERED"
    );
  }

  const allowedTools =
    new Set(
      Array.isArray(
        agent.allowedTools
      )
        ? agent.allowedTools
        : []
    );

  if (
    !allowedTools.has(
      tool.key
    )
  ) {
    throw policyError(
      "This registered tool is not granted to the selected AI agent.",
      "AI_AGENT_TOOL_NOT_ALLOWED"
    );
  }

  const requested =
    normaliseAutonomyLevel(
      requestedAutonomy
    );
  const agentCeiling =
    normaliseAutonomyLevel(
      agent.autonomyCeiling ||
      "A0"
    );
  const toolCeiling =
    normaliseAutonomyLevel(
      tool.maximumAutonomy ||
      "A0"
    );

  if (
    !autonomyAtMost(
      requested,
      AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING
    )
  ) {
    throw policyError(
      "The requested autonomy level is not activated in the current AI Workforce release.",
      "AI_AUTONOMY_NOT_ACTIVATED"
    );
  }

  if (
    !autonomyAtMost(
      requested,
      agentCeiling
    )
  ) {
    throw policyError(
      "The requested autonomy exceeds the agent policy ceiling.",
      "AI_AGENT_AUTONOMY_EXCEEDED"
    );
  }

  if (
    !autonomyAtMost(
      requested,
      toolCeiling
    )
  ) {
    throw policyError(
      "The requested autonomy exceeds the registered tool ceiling.",
      "AI_TOOL_AUTONOMY_EXCEEDED"
    );
  }

  if (
    tool.mutation === true
  ) {
    throw policyError(
      "Direct mutating AI tools are disabled. Consequential changes must use the governed proposal and approval path.",
      "AI_DIRECT_MUTATION_BLOCKED"
    );
  }

  if (
    [
      "high",
      "critical",
    ].includes(
      String(
        tool.riskLevel ||
        ""
      ).toLowerCase()
    )
  ) {
    throw policyError(
      "High-impact AI tools are not activated for direct Workforce invocation.",
      "AI_HIGH_RISK_TOOL_BLOCKED"
    );
  }

  return Object.freeze({
    allowed: true,
    requestedAutonomy:
      requested,
    effectiveAutonomy:
      requested,
    requiresHumanApproval:
      tool.requiresHumanApproval ===
        true ||
      requested !== "A0",
    directMutation:
      false,
  });
}

export default {
  AI_AUTONOMY_LEVELS,
  AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING,
  autonomyAtMost,
  evaluateAgentToolPolicy,
  normaliseAutonomyLevel,
};
