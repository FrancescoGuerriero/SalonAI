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

function capabilityKeys(values) {
  return [
    ...new Set(
      values
        .flat()
        .map((value) => text(value).toLowerCase())
        .filter(Boolean)
    ),
  ];
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

function entitlementRecord({
  capability,
  businessId,
  grant,
}) {
  return Object.freeze({
    moduleKey: capability,
    businessId,
    manifestRevision: grant?.manifestRevision || null,
    verticalId: grant?.verticalId || null,
    source: grant?.source || null,
  });
}

function assertAuthority(request) {
  const authority = request?.effectiveAuthority;
  const businessId = text(authority?.businessId);

  if (!authority || !businessId) {
    throw entitlementError(
      "Effective Business authority must be resolved before checking commercial module entitlement.",
      "COMMERCIAL_MODULE_AUTHORITY_REQUIRED",
      500
    );
  }

  return { authority, businessId };
}

function assertComposition(composition) {
  if (!composition) {
    throw entitlementError(
      "The requested commercial module is unavailable for this tenant.",
      "COMMERCIAL_MODULE_NOT_PROVISIONED"
    );
  }

  return composition;
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

  function requireCommercialModule(moduleKey) {
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
        const { authority, businessId } = assertAuthority(request);
        const composition = assertComposition(
          await compositionLoader(businessId)
        );
        const grant = capabilityDecisionFromComposition({
          authority,
          composition,
          capability,
        });

        request.commercialModuleEntitlement = entitlementRecord({
          capability,
          businessId,
          grant,
        });

        return next();
      } catch (error) {
        return next(error);
      }
    };
  }

  function requireAnyCommercialModule(...moduleKeys) {
    const capabilities = capabilityKeys(moduleKeys);

    if (capabilities.length === 0) {
      throw entitlementError(
        "At least one commercial module key is required.",
        "COMMERCIAL_MODULE_KEY_REQUIRED",
        500
      );
    }

    return async function anyCommercialModuleEntitlementMiddleware(
      request,
      response,
      next
    ) {
      try {
        const { authority, businessId } = assertAuthority(request);
        const composition = assertComposition(
          await compositionLoader(businessId)
        );

        let lastError = null;

        for (const capability of capabilities) {
          try {
            const grant = capabilityDecisionFromComposition({
              authority,
              composition,
              capability,
            });

            request.commercialModuleEntitlement = entitlementRecord({
              capability,
              businessId,
              grant,
            });

            return next();
          } catch (error) {
            lastError = error;
          }
        }

        throw lastError || entitlementError(
          "None of the requested commercial modules is available for this tenant.",
          "CAPABILITY_UNAVAILABLE"
        );
      } catch (error) {
        return next(error);
      }
    };
  }

  return Object.assign(requireCommercialModule, {
    requireAnyCommercialModule,
  });
}

export const requireCommercialModule =
  createCommercialModuleEntitlementMiddleware();

export const requireAnyCommercialModule =
  requireCommercialModule.requireAnyCommercialModule;

export default requireCommercialModule;
