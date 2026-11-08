import {
  evaluateAgentToolPolicy,
} from "./aiWorkforcePolicy.js";
import {
  requireAiWorkforceTool,
} from "./aiWorkforceToolRegistry.js";
import {
  assertBusinessResourceAuthority,
  assertEffectivePermission,
  hasLocationAuthority,
} from "../../services/effectiveAuthorityService.js";

function blocked(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 403;
  throw error;
}

/**
 * Build a non-executing AI Workforce tool decision from server-resolved
 * membership authority and tenant product composition.
 *
 * Only trusted backend services may supply `effectiveAuthority`,
 * `composition` and `enabledEntitlements`; never accept them from an
 * HTTP body or model-generated content.
 *
 * This is a preflight contract, not a tool executor or an authorisation
 * token. The canonical tool handler must recheck authority at execution.
 */
export function previewAiWorkforceToolInvocation({
  agent,
  toolKey,
  requestedAutonomy = "A0",
  effectiveAuthority,
  composition,
  locationId = null,
  enabledEntitlements = [],
} = {}) {
  if (!effectiveAuthority?.businessId) {
    blocked("Trusted membership authority is required.", "AI_TOOL_TENANT_REQUIRED");
  }

  const manifest = composition?.manifest;
  if (!manifest || manifest.status !== "active" ||
      String(manifest.businessId || "") !== String(effectiveAuthority.businessId)) {
    blocked("Active composition for the trusted business is required.", "AI_TOOL_COMPOSITION_REQUIRED");
  }
  assertBusinessResourceAuthority(effectiveAuthority, manifest.businessId);

  if (!Array.isArray(composition.enabledCapabilityPackKeys) ||
      !composition.enabledCapabilityPackKeys.includes("ai")) {
    blocked("The shared AI capability is not enabled for this tenant.", "AI_TOOL_CAPABILITY_NOT_ENABLED");
  }

  const verticalId = String(composition.vertical?.id || "");
  if (!verticalId || (Array.isArray(agent?.allowedVerticals) &&
      !agent.allowedVerticals.includes("*") &&
      !agent.allowedVerticals.includes(verticalId))) {
    blocked("This agent is not enabled for the tenant vertical.", "AI_TOOL_VERTICAL_NOT_ALLOWED");
  }

  const requiredEntitlement = String(agent?.requiredEntitlement || "").trim();
  if (requiredEntitlement && (!Array.isArray(enabledEntitlements) ||
      !enabledEntitlements.includes(requiredEntitlement))) {
    blocked("The required AI agent entitlement is not enabled.", "AI_TOOL_AGENT_NOT_ENTITLED");
  }

  const selectedLocation = locationId || effectiveAuthority.locationId || null;
  if (locationId && !hasLocationAuthority(effectiveAuthority, locationId)) {
    blocked("This location is outside the trusted membership.", "AI_TOOL_LOCATION_NOT_ALLOWED");
  }
  if (selectedLocation && !hasLocationAuthority(effectiveAuthority, selectedLocation)) {
    blocked("The selected location is outside the trusted membership.", "AI_TOOL_LOCATION_NOT_ALLOWED");
  }

  // A0 planning only: no live tool invocation, A1 proposal or direct writes.
  if (requestedAutonomy !== "A0") {
    blocked("This preflight preview is read-only (A0).", "AI_TOOL_PREVIEW_READ_ONLY");
  }

  const tool = requireAiWorkforceTool(toolKey);
  const policy = evaluateAgentToolPolicy({ agent, tool, requestedAutonomy });
  assertEffectivePermission(effectiveAuthority, "ai:use");
  assertEffectivePermission(effectiveAuthority, tool.requiredPermission);

  // Location-scoped permissions are invalid without a trusted active location.
  // assertEffectivePermission enforces this for location-class permissions.
  return Object.freeze({
    decision: "authorised_for_read_only_planning",
    agentKey: agent.key,
    agentVersion: agent.version,
    toolKey: tool.key,
    businessId: String(effectiveAuthority.businessId),
    locationId: selectedLocation ? String(selectedLocation) : null,
    requestedAutonomy: policy.requestedAutonomy,
    requiresHumanApproval: policy.requiresHumanApproval,
    executionAuthorised: false,
    mutationAuthorised: false,
    entitlementSource: "server-resolved",
  });
}

export default previewAiWorkforceToolInvocation;
