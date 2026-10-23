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
    "ai-receptionist":
      Object.freeze({
        key:
          "ai-receptionist",
        version:
          "1",
        displayName:
          "AI Receptionist",
        purpose:
          "Interpret customer booking and service enquiries on governed channels while deterministic SalonAI services retain booking, consultation and handoff authority.",
        lifecycle:
          "active",
        allowedVerticals: [
          "salon",
        ],
        requiredEntitlement:
          "whatsapp-booking",
        allowedTools: [
          "service.catalogue.read",
          "availability.search",
        ],
        autonomyCeiling:
          "A0",
        evaluationSuite: {
          key:
            "ai-receptionist-a0-v1",
          minimumTaskSuccessRate:
            0.9,
          maximumPolicyViolationRate:
            0,
        },
      }),
    "ai-retention":
      Object.freeze({
        key:
          "ai-retention",
        version:
          "1",
        displayName:
          "AI Retention Pilot",
        purpose:
          "Use canonical retention-risk evidence to propose a governed customer workflow enrolment for human review without sending communications or changing customer state directly.",
        lifecycle:
          "active",
        allowedVerticals: [
          "salon",
        ],
        requiredEntitlement:
          "ai-tools",
        allowedTools: [
          "retention.risk.read",
          "workflow.enrolment.propose",
        ],
        autonomyCeiling:
          "A1",
        evaluationSuite: {
          key:
            "ai-retention-a1-v1",
          minimumTaskSuccessRate:
            0.9,
          maximumPolicyViolationRate:
            0,
        },
      }),
    "ai-lead":
      Object.freeze({
        key:
          "ai-lead",
        version:
          "1",
        displayName:
          "AI Lead Pilot",
        purpose:
          "Use canonical lead-score evidence to propose a governed nurture workflow for human review without changing lead, customer, booking or communication state directly.",
        lifecycle:
          "active",
        allowedVerticals: [
          "salon",
        ],
        requiredEntitlement:
          "ai-tools",
        allowedTools: [
          "lead.score.read",
          "workflow.enrolment.propose",
        ],
        autonomyCeiling:
          "A1",
        evaluationSuite: {
          key:
            "ai-lead-a1-v1",
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

export function listBuiltinAiAgentDefinitions() {
  return Object.values(BUILTIN_AGENTS).map(
    (definition) => {
      validateAgentDefinitionContract(definition);
      return definition;
    }
  );
}

export default {
  getBuiltinAiAgentDefinition,
  listBuiltinAiAgentDefinitions,
};
