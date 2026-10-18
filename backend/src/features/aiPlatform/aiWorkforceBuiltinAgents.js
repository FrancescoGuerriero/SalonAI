import {
  validateAgentDefinitionContract,
} from "./aiWorkforceRegistryService.js";

const BUILTIN_AGENTS =
  Object.freeze({
    "business-adviser":
      Object.freeze({
        key:
          "business-adviser",
        version:
          "1",
        displayName:
          "AI Business Adviser",
        purpose:
          "Explain authorised tenant-scoped operational metrics and surface evidence-backed observations without mutating business state.",
        lifecycle:
          "active",
        allowedVerticals: [
          "salon",
        ],
        requiredEntitlement:
          "",
        allowedTools: [
          "business.metrics.read",
        ],
        autonomyCeiling:
          "A0",
        evaluationSuite: {
          key:
            "business-adviser-a0-v1",
          minimumTaskSuccessRate:
            0.9,
          maximumPolicyViolationRate:
            0,
        },
      }),
  });

export function getBuiltinAiAgentDefinition(
  key
) {
  const cleanKey =
    String(
      key ||
      ""
    )
      .trim()
      .toLowerCase();
  const definition =
    BUILTIN_AGENTS[
      cleanKey
    ];

  if (!definition) {
    const error = new Error(
      "The requested built-in AI agent is not registered."
    );
    error.code =
      "AI_AGENT_NOT_REGISTERED";
    error.statusCode = 404;
    throw error;
  }

  validateAgentDefinitionContract(
    definition
  );

  return definition;
}

export default {
  getBuiltinAiAgentDefinition,
};
