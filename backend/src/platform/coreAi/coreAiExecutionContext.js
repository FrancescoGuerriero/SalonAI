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
