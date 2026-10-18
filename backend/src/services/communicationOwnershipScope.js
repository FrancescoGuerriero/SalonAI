function scopeError(message, code = "COMMUNICATION_TENANT_SCOPE_REQUIRED") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 404;
  return error;
}

function id(value) {
  const candidate = value?._id ?? value;
  const text = String(candidate ?? "").trim();
  return text || null;
}

export function requireCommunicationBusinessContext(tenantContext = {}) {
  const businessId = id(tenantContext.businessId);
  if (!businessId) {
    throw scopeError(
      "Trusted Business context is required for communications access."
    );
  }
  return businessId;
}

export function communicationBusinessFilter(tenantContext = {}) {
  return Object.freeze({
    business: requireCommunicationBusinessContext(tenantContext),
  });
}

export function communicationLocationFilter(
  tenantContext = {},
  { requireSelectedLocation = false, includeBusinessWide = true } = {}
) {
  const business = requireCommunicationBusinessContext(tenantContext);
  const location = id(tenantContext.locationId);

  if (requireSelectedLocation && !location) {
    throw scopeError(
      "A trusted selected Location is required for this communications operation.",
      "COMMUNICATION_LOCATION_SCOPE_REQUIRED"
    );
  }

  if (!location) return Object.freeze({ business });
  if (!includeBusinessWide) return Object.freeze({ business, location });

  return Object.freeze({
    business,
    $or: [
      { location },
      { location: null },
      { location: { $exists: false } },
    ],
  });
}

export function assertCommunicationResourceWithinScope(
  resource,
  tenantContext = {},
  { requireLocation = false, allowBusinessWide = true } = {}
) {
  const business = requireCommunicationBusinessContext(tenantContext);
  const location = id(tenantContext.locationId);
  const resourceBusiness = id(resource?.business);
  const resourceLocation = id(resource?.location);

  if (!resource || !resourceBusiness || resourceBusiness !== business) {
    throw scopeError(
      "Communication resource not found.",
      "COMMUNICATION_RESOURCE_NOT_FOUND"
    );
  }

  if (requireLocation && !location) {
    throw scopeError(
      "A trusted selected Location is required for this communications operation.",
      "COMMUNICATION_LOCATION_SCOPE_REQUIRED"
    );
  }

  if (location && resourceLocation && resourceLocation !== location) {
    throw scopeError(
      "Communication resource not found.",
      "COMMUNICATION_RESOURCE_NOT_FOUND"
    );
  }

  if (location && !resourceLocation && !allowBusinessWide) {
    throw scopeError(
      "Communication resource not found.",
      "COMMUNICATION_RESOURCE_NOT_FOUND"
    );
  }

  return true;
}

export function stripCommunicationOwnershipInput(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const {
    business,
    location,
    businessId,
    locationId,
    tenantId,
    tenant,
    ...safe
  } = payload;

  void business;
  void location;
  void businessId;
  void locationId;
  void tenantId;
  void tenant;
  return safe;
}
