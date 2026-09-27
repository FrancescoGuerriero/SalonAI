function tenantError(
  message,
  code,
  statusCode
) {
  const error =
    new Error(
      message
    );
  error.code =
    code;
  error.statusCode =
    statusCode;
  return error;
}

function idText(
  value
) {
  const candidate =
    value &&
    typeof value ===
      "object" &&
    "_id" in value
      ? value._id
      : value;

  return String(
    candidate || ""
  ).trim();
}

export function publicServiceBusinessId(
  request
) {
  const businessId =
    idText(
      request
        ?.publicTenantContext
        ?.businessId
    );

  if (!businessId) {
    throw tenantError(
      "The requested tenant is unavailable.",
      "PUBLIC_TENANT_NOT_FOUND",
      404
    );
  }

  return businessId;
}

export function managementServiceBusinessId(
  request
) {
  const businessId =
    idText(
      request
        ?.effectiveAuthority
        ?.businessId
    );

  if (!businessId) {
    throw tenantError(
      "Trusted effective authority is required for Service management.",
      "SERVICE_TENANT_AUTHORITY_REQUIRED",
      401
    );
  }

  return businessId;
}

export function scopedServiceFilter({
  businessId,
  domainFilter = {},
} = {}) {
  const trustedBusinessId =
    idText(
      businessId
    );

  if (!trustedBusinessId) {
    throw tenantError(
      "Trusted Business scope is required.",
      "SERVICE_TENANT_SCOPE_REQUIRED",
      500
    );
  }

  if (
    !domainFilter ||
    typeof domainFilter !==
      "object" ||
    Array.isArray(
      domainFilter
    )
  ) {
    throw tenantError(
      "Service domain filter must be an object.",
      "INVALID_SERVICE_TENANT_FILTER",
      500
    );
  }

  return {
    business:
      trustedBusinessId,
    ...domainFilter,
  };
}

export function serviceResourceNotFound() {
  return tenantError(
    "Service not found.",
    "SERVICE_NOT_FOUND",
    404
  );
}

export default {
  managementServiceBusinessId,
  publicServiceBusinessId,
  scopedServiceFilter,
  serviceResourceNotFound,
};
