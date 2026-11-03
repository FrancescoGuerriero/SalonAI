import { getBuiltinAiAgentDefinition } from "../../features/aiPlatform/aiWorkforceBuiltinAgents.js";
import { requireAiWorkforceTool } from "../../features/aiPlatform/aiWorkforceToolRegistry.js";
import { evaluateAgentToolPolicy } from "../../features/aiPlatform/aiWorkforcePolicy.js";

function denied(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 403;
  return error;
}

/**
 * Shared pre-invocation guard. Reuses the canonical Workforce agent/tool
 * registries and autonomy policy; does not execute any tool or provider call.
 * The existing AiAgentRun ledger records accepted invocations and outcomes.
 */
export function authoriseCoreAiTool({ agentKey, toolKey, requestedAutonomy = "A0" } = {}) {
  if (!agentKey || !toolKey) {
    throw denied("Registered AI agent and tool are required.", "CORE_AI_TOOL_CONFIGURATION_REQUIRED");
  }
  return function coreAiToolAuthorisation(request, response, next) {
    try {
      const context = request?.coreAiExecutionContext;
      const authority = request?.effectiveAuthority;
      const entitlement = request?.commercialModuleEntitlement;
      if (!context || !Object.isFrozen(context) ||
          !authority || !entitlement ||
          context.businessId !== String(authority.businessId || "") ||
          context.businessId !== String(entitlement.businessId || "") ||
          context.userId !== String(authority.userId || "") ||
          context.moduleKey !== entitlement.moduleKey ||
          context.toolKey !== agentKey ||
          context.externalWritesAllowed !== false) {
        throw denied("Verified Core AI execution context is required.", "CORE_AI_TOOL_CONTEXT_REQUIRED");
      }

      const agent = getBuiltinAiAgentDefinition(agentKey);
      const tool = requireAiWorkforceTool(toolKey);
      if (entitlement.verticalId &&
          !agent.allowedVerticals.includes(entitlement.verticalId)) {
        throw denied("AI agent is unavailable for this tenant vertical.", "CORE_AI_TOOL_VERTICAL_UNAVAILABLE");
      }
      if (!Array.isArray(authority.permissions) ||
          !authority.permissions.includes("ai:use") ||
          !authority.permissions.includes(tool.requiredPermission)) {
        throw denied("The actor is not authorised to use the AI tool.", "CORE_AI_TOOL_PERMISSION_REQUIRED");
      }

      const decision = evaluateAgentToolPolicy({ agent, tool, requestedAutonomy });
      if (!decision.allowed || decision.directMutation ||
          (decision.requiresHumanApproval && !request?.coreAiApprovedProposal)) {
        throw denied("AI tool execution requires a separately approved proposal.", "CORE_AI_TOOL_APPROVAL_REQUIRED");
      }
      request.coreAiToolDecision = Object.freeze({
        agentKey: agent.key,
        toolKey: tool.key,
        businessId: context.businessId,
        locationId: context.locationId,
        moduleKey: context.moduleKey,
        manifestRevision: context.manifestRevision,
        autonomy: decision.effectiveAutonomy,
        mutation: false,
        auditRequired: true,
      });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
