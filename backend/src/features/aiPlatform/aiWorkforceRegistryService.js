import AiAgentDefinition from "./AiAgentDefinition.js";
import {
  AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING,
  autonomyAtMost,
  normaliseAutonomyLevel,
} from "./aiWorkforcePolicy.js";
import {
  requireAiWorkforceTool,
} from "./aiWorkforceToolRegistry.js";

function registryError(
  message,
  code
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

export function validateAgentDefinitionContract(
  definition
) {
  if (!definition) {
    throw registryError(
      "AI agent definition is required.",
      "AI_AGENT_DEFINITION_REQUIRED"
    );
  }

  const key =
    String(
      definition.key ||
      ""
    ).trim();
  const version =
    String(
      definition.version ||
      ""
    ).trim();

  if (!key || !version) {
    throw registryError(
      "AI agent key and version are required.",
      "AI_AGENT_IDENTITY_REQUIRED"
    );
  }

  const autonomyCeiling =
    normaliseAutonomyLevel(
      definition.autonomyCeiling ||
      "A0"
    );

  if (
    definition.lifecycle === "active" &&
    !autonomyAtMost(
      autonomyCeiling,
      AI_WORKFORCE_ACTIVE_AUTONOMY_CEILING
    )
  ) {
    throw registryError(
      "An active AI agent cannot exceed the currently activated Workforce autonomy ceiling.",
      "AI_AGENT_AUTONOMY_NOT_ACTIVATED"
    );
  }

  const tools =
    Array.from(
      new Set(
        Array.isArray(
          definition.allowedTools
        )
          ? definition.allowedTools
              .map((value) =>
                String(value || "").trim()
              )
              .filter(Boolean)
          : []
      )
    );

  for (const toolKey of tools) {
    const tool =
      requireAiWorkforceTool(
        toolKey
      );

    if (
      !autonomyAtMost(
        tool.maximumAutonomy,
        autonomyCeiling
      )
    ) {
      throw registryError(
        `Tool ${toolKey} has a higher autonomy ceiling than agent ${key}.`,
        "AI_AGENT_TOOL_CEILING_INVALID"
      );
    }
  }

  return Object.freeze({
    key,
    version,
    lifecycle:
      definition.lifecycle ||
      "draft",
    autonomyCeiling,
    allowedTools:
      Object.freeze(tools),
  });
}

export async function getActiveAgentDefinition(
  key
) {
  const cleanKey =
    String(
      key ||
      ""
    )
      .trim()
      .toLowerCase();

  if (!cleanKey) {
    throw registryError(
      "AI agent key is required.",
      "AI_AGENT_KEY_REQUIRED"
    );
  }

  const agent =
    await AiAgentDefinition.findOne({
      key: cleanKey,
      lifecycle: "active",
    })
      .sort({
        createdAt: -1,
      })
      .lean();

  if (!agent) {
    const error = registryError(
      "The requested AI agent is not active.",
      "AI_AGENT_NOT_ACTIVE"
    );
    error.statusCode = 404;
    throw error;
  }

  validateAgentDefinitionContract(
    agent
  );

  return agent;
}

export default {
  getActiveAgentDefinition,
  validateAgentDefinitionContract,
};
