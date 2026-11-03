import { hasLocationAuthority } from "../../services/effectiveAuthorityService.js";

function policyError(message, code, statusCode = 403) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function identity(value) {
  return String(value ?? "").trim();
}

/**
 * Attaches a validated, immutable execution context for AI assistants.
 * This does not authorise model execution, provider writes or downstream tools.
 * Those operations require separate explicit tool policy and approval checks.
 */
export function requireCoreAiExecutionContext({ moduleKey, toolKey } = {}) {
  const expectedModule = identity(moduleKey);
  const expectedTool = identity(toolKey);
  if (!expectedModule || !expectedTool) {
    throw policyError("Core AI module and tool identifiers are required.", "CORE_AI_POLICY_INVALID", 500);
  }

  return function coreAiExecutionContextMiddleware(request, response, next) {
    try {
      const authority = request?.effectiveAuthority;
      const grant = request?.commercialModuleEntitlement;
      const businessId = identity(authority?.businessId);
      const userId = identity(authority?.userId);
      const grantBusiness = identity(grant?.businessId);

      if (!businessId || !userId || !grantBusiness || grantBusiness !== businessId ||
          grant?.moduleKey !== expectedModule) {
        throw policyError("Core AI requires matching tenant authority and module allocation.", "CORE_AI_AUTHORITY_REQUIRED");
      }
      if (!Array.isArray(authority.permissions) || !authority.permissions.includes("ai:use")) {
        throw policyError("Core AI user permission is required.", "CORE_AI_PERMISSION_REQUIRED");
      }

      const locationId = identity(authority.locationId) || null;
      if (locationId && !hasLocationAuthority(authority, locationId)) {
        throw policyError("Core AI Location is outside effective authority.", "CORE_AI_LOCATION_FORBIDDEN");
      }

      const allowedLocationIds = Array.isArray(authority.allowedLocationIds)
        ? Object.freeze([...authority.allowedLocationIds])
        : null;

      request.coreAiExecutionContext = Object.freeze({
        toolKey: expectedTool,
        moduleKey: expectedModule,
        businessId,
        userId,
        locationId,
        locationAccessMode: authority.locationAccessMode === "all" ? "all" : "selected",
        allowedLocationIds,
        manifestRevision: grant.manifestRevision || null,
        externalWritesAllowed: false,
        automaticModelPromotionAllowed: false,
        requiresHumanApprovalForConsequentialActions: true,
      });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Verifies the exact module and scoped inputs before any internal AI service
 * reads evidence or performs inference. The route is not the only trust boundary.
 */
export function assertCoreAiModuleExecutionContext({
  context, moduleKey, toolKey, businessId, locationId = null,
  allowedLocationIds = [], actorUserId,
} = {}) {
  const requestedLocations = Array.isArray(allowedLocationIds) ? allowedLocationIds.map(identity) : [];
  const authorisedLocations = Array.isArray(context?.allowedLocationIds)
    ? context.allowedLocationIds.map(identity)
    : [];
  const expectedLocation = identity(locationId) || null;
  if (!context || !Object.isFrozen(context) ||
      context.moduleKey !== moduleKey || context.toolKey !== toolKey ||
      context.businessId !== identity(businessId) ||
      context.userId !== identity(actorUserId) ||
      context.locationId !== expectedLocation ||
      context.externalWritesAllowed !== false ||
      context.automaticModelPromotionAllowed !== false ||
      context.requiresHumanApprovalForConsequentialActions !== true ||
      JSON.stringify(requestedLocations) !== JSON.stringify(authorisedLocations) ||
      (!expectedLocation &&
       context.locationAccessMode !== "all" &&
       authorisedLocations.length === 0)) {
    throw policyError(
      "AI module execution requires matching trusted Business, Location, actor and module scope.",
      "CORE_AI_MODULE_EXECUTION_SCOPE_REQUIRED"
    );
  }
  return context;
}
