import TenantProductManifest from "../models/TenantProductManifest.js";
import {
  resolveEffectiveTenantProductComposition,
} from "../platform/productComposition/tenantProductManifest.js";
import {
  capabilityDecisionFromComposition,
} from "../services/operationAccessService.js";

function entitlementError(
  message,
  code,
  statusCode = 404
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function text(value) {
  return String(value ?? "").trim();
}

async function loadActiveComposition(businessId) {
  const manifestRecord = await TenantProductManifest.findOne({
    business: businessId,
    status: "active",
  })
    .sort({ manifestRevision: -1 })
    .lean();

  if (!manifestRecord) {
    return null;
  }

  return resolveEffectiveTenantProductComposition({
    manifest: {
      ...manifestRecord,
      businessId: String(manifestRecord.business),
      manifestRevision: String(manifestRecord.manifestRevision),
      effectiveFrom: manifestRecord.effectiveFrom
        ? new Date(manifestRecord.effectiveFrom).toISOString()
        : "",
    },
  });
}

export function createCommercialModuleEntitlementMiddleware({
  compositionLoader = loadActiveComposition,
} = {}) {
  if (typeof compositionLoader !== "function") {
    throw entitlementError(
      "Commercial module composition loader must be a function.",
      "INVALID_COMMERCIAL_MODULE_ENTITLEMENT_MIDDLEWARE",
      500
    );
  }

  return function requireCommercialModule(moduleKey) {
    const capability = text(moduleKey).toLowerCase();

    if (!capability) {
      throw entitlementError(
        "A commercial module key is required.",
        "COMMERCIAL_MODULE_KEY_REQUIRED",
        500
      );
    }

    return async function commercialModuleEntitlementMiddleware(
      request,
      response,
      next
    ) {
      try {
        const authority = request?.effectiveAuthority;
        const businessId = text(authority?.businessId);

        if (!authority || !businessId) {
          throw entitlementError(
            "Effective Business authority must be resolved before checking commercial module entitlement.",
            "COMMERCIAL_MODULE_AUTHORITY_REQUIRED",
            500
          );
        }

        const composition = await compositionLoader(businessId);

        if (!composition) {
          throw entitlementError(
            "The requested commercial module is unavailable for this tenant.",
            "COMMERCIAL_MODULE_NOT_PROVISIONED"
          );
        }

        const grant = capabilityDecisionFromComposition({
          authority,
          composition,
          capability,
        });

        request.commercialModuleEntitlement = Object.freeze({
          moduleKey: capability,
          businessId,
          manifestRevision: grant?.manifestRevision || null,
          verticalId: grant?.verticalId || null,
          source: grant?.source || null,
        });

        return next();
      } catch (error) {
        return next(error);
      }
    };
  };
}

export const requireCommercialModule =
  createCommercialModuleEntitlementMiddleware();

export default requireCommercialModule;
