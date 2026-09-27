import Business from "../../models/Business.js";
import BusinessDomain from "../../models/BusinessDomain.js";
import {
  extractServerTrustedHost,
  normaliseTenantHost,
} from "./tenantHost.js";

function publicTenantError(
  message,
  code = "PUBLIC_TENANT_NOT_FOUND",
  statusCode = 404
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function findDomainByHost(host) {
  return BusinessDomain.findOne({
    host,
    status: "active",
  }).lean();
}

async function findBusinessById(
  businessId
) {
  return Business.findOne({
    _id: businessId,
    status: {
      $in: [
        "trial",
        "active",
      ],
    },
  }).lean();
}

export async function resolvePublicTenantContext({
  host,
  findDomain = findDomainByHost,
  findBusiness = findBusinessById,
}) {
  if (
    typeof findDomain !== "function" ||
    typeof findBusiness !== "function"
  ) {
    throw publicTenantError(
      "Public tenant repositories are not configured.",
      "INVALID_PUBLIC_TENANT_CONTEXT",
      500
    );
  }

  const trustedHost =
    normaliseTenantHost(host);

  const domain =
    await findDomain(
      trustedHost
    );

  if (
    !domain ||
    domain.status !== "active"
  ) {
    throw publicTenantError(
      "No active tenant is configured for this host."
    );
  }

  const business =
    await findBusiness(
      domain.business
    );

  if (!business) {
    throw publicTenantError(
      "The tenant configured for this host is unavailable."
    );
  }

  if (
    String(domain.business) !==
      String(business._id)
  ) {
    throw publicTenantError(
      "The tenant-domain mapping is invalid."
    );
  }

  return Object.freeze({
    businessId:
      String(business._id),
    businessSlug:
      String(
        business.slug || ""
      ),
    businessName:
      String(
        business.name || ""
      ),
    verticalId:
      String(
        business.businessType ||
          ""
      ),
    host: trustedHost,
    domainRole:
      String(domain.role || ""),
  });
}

export function createPublicTenantContextMiddleware({
  trustForwardedHost = false,
  hostResolver =
    extractServerTrustedHost,
  contextResolver =
    resolvePublicTenantContext,
} = {}) {
  if (
    typeof hostResolver !==
      "function" ||
    typeof contextResolver !==
      "function"
  ) {
    throw publicTenantError(
      "Public tenant middleware is not configured.",
      "INVALID_PUBLIC_TENANT_CONTEXT",
      500
    );
  }

  return async function publicTenantContextMiddleware(
    request,
    response,
    next
  ) {
    try {
      const host =
        await hostResolver(
          request,
          {
            trustForwardedHost,
          }
        );

      const context =
        await contextResolver({
          host,
        });

      const existingBusinessId =
        request
          ?.trustedTenantSelection
          ?.businessId;

      if (
        existingBusinessId &&
        String(
          existingBusinessId
        ) !==
          context.businessId
      ) {
        throw publicTenantError(
          "The request contains conflicting trusted tenant context."
        );
      }

      request.publicTenantContext =
        context;

      request.trustedTenantSelection =
        Object.freeze({
          ...(
            request.trustedTenantSelection ||
            {}
          ),
          businessId:
            context.businessId,
        });

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const publicTenantContextMiddleware =
  createPublicTenantContextMiddleware();

export default publicTenantContextMiddleware;
