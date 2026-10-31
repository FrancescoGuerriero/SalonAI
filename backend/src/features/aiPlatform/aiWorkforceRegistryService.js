import AiAgentDefinition from "./AiAgentDefinition.js";
import {
  getAiEvaluationSuite,
} from "./aiEvaluationSuiteRegistry.js";
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

function normalisedList(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function validateGroundingPolicy(definition, key) {
  const policy = definition.groundingPolicy || {
    mode: "canonical-tools-only",
  };
  const mode = String(policy.mode || "canonical-tools-only").trim();

  if (!["canonical-tools-only", "knowledge-retrieval"].includes(mode)) {
    throw registryError(
      `Agent ${key} has an unsupported grounding policy.`,
      "AI_AGENT_GROUNDING_POLICY_INVALID"
    );
  }

  if (mode === "knowledge-retrieval") {
    const scopeModes = normalisedList(policy.allowedScopeModes);
    const sourceTypes = normalisedList(policy.allowedSourceTypes);
    const maxKnowledgeSources = Number(policy.maxKnowledgeSources || 0);

    if (policy.profileRequired !== true) {
      throw registryError(
        `Knowledge-grounded agent ${key} must require a governed AI profile.`,
        "AI_AGENT_GROUNDING_PROFILE_REQUIRED"
      );
    }
    if (policy.citationsRequired !== true) {
      throw registryError(
        `Knowledge-grounded agent ${key} must require citations.`,
        "AI_AGENT_GROUNDING_CITATIONS_REQUIRED"
      );
    }
    if (scopeModes.length === 0) {
      throw registryError(
        `Knowledge-grounded agent ${key} requires explicit knowledge scope modes.`,
        "AI_AGENT_GROUNDING_SCOPE_REQUIRED"
      );
    }
    if (sourceTypes.length === 0) {
      throw registryError(
        `Knowledge-grounded agent ${key} requires explicit knowledge source types.`,
        "AI_AGENT_GROUNDING_SOURCE_TYPES_REQUIRED"
      );
    }
    if (
      !Number.isInteger(maxKnowledgeSources) ||
      maxKnowledgeSources < 1 ||
      maxKnowledgeSources > 12
    ) {
      throw registryError(
        `Knowledge-grounded agent ${key} has an invalid knowledge-source limit.`,
        "AI_AGENT_GROUNDING_LIMIT_INVALID"
      );
    }

    return Object.freeze({
      mode,
      profileRequired: true,
      citationsRequired: true,
      allowedScopeModes: Object.freeze(scopeModes),
      allowedSourceTypes: Object.freeze(sourceTypes),
      maxKnowledgeSources,
    });
  }

  return Object.freeze({
    mode,
    profileRequired: false,
    citationsRequired: false,
    allowedScopeModes: Object.freeze([]),
    allowedSourceTypes: Object.freeze([]),
    maxKnowledgeSources: 0,
  });
}

function validateEvaluationSuite(definition, key) {
  const suiteKey = String(definition.evaluationSuite?.key || "").trim();
  if (!suiteKey) {
    return null;
  }

  const suite = getAiEvaluationSuite(suiteKey);
  if (!suite || !suite.appliesTo.includes(key)) {
    throw registryError(
      `Agent ${key} must reference a registered evaluation suite that applies to the agent.`,
      "AI_AGENT_EVALUATION_SUITE_INVALID"
    );
  }

  const requiredTaskSuccess = Number(
    definition.evaluationSuite?.minimumTaskSuccessRate
  );
  const maximumPolicyViolation = Number(
    definition.evaluationSuite?.maximumPolicyViolationRate ?? 0
  );
  const taskThreshold = suite.thresholds.taskSuccessRate;
  const policyThreshold = suite.thresholds.policyViolationRate;

  if (
    Number.isFinite(requiredTaskSuccess) &&
    (!taskThreshold ||
      taskThreshold.comparator !== ">=" ||
      taskThreshold.value < requiredTaskSuccess)
  ) {
    throw registryError(
      `Agent ${key} evaluation suite weakens its minimum task-success requirement.`,
      "AI_AGENT_EVALUATION_TASK_THRESHOLD_INVALID"
    );
  }

  if (
    Number.isFinite(maximumPolicyViolation) &&
    (!policyThreshold ||
      policyThreshold.comparator !== "<=" ||
      policyThreshold.value > maximumPolicyViolation)
  ) {
    throw registryError(
      `Agent ${key} evaluation suite weakens its policy-violation requirement.`,
      "AI_AGENT_EVALUATION_POLICY_THRESHOLD_INVALID"
    );
  }

  return suite;
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

  const tools = normalisedList(definition.allowedTools);

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

  const groundingPolicy = validateGroundingPolicy(definition, key);
  const evaluationSuite = validateEvaluationSuite(definition, key);

  return Object.freeze({
    key,
    version,
    lifecycle:
      definition.lifecycle ||
      "draft",
    autonomyCeiling,
    allowedTools:
      Object.freeze(tools),
    groundingPolicy,
    evaluationSuiteKey:
      evaluationSuite?.key || null,
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
