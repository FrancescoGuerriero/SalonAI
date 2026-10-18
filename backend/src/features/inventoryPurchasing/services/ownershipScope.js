function scopeError(message, code = "INVENTORY_TENANT_SCOPE_REQUIRED") {
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

export function requireInventoryBusinessContext(tenantContext = {}) {
  const businessId = id(tenantContext.businessId);
  if (!businessId) {
    throw scopeError(
      "Trusted Business context is required for inventory/purchasing access."
    );
  }
  return businessId;
}

export function inventoryBusinessFilter(tenantContext = {}) {
  return Object.freeze({
    business: requireInventoryBusinessContext(tenantContext),
  });
}

export function inventoryLocationFilter(
  tenantContext = {},
  { requireSelectedLocation = false, includeBusinessWide = false } = {}
) {
  const business = requireInventoryBusinessContext(tenantContext);
  const location = id(tenantContext.locationId);

  if (requireSelectedLocation && !location) {
    throw scopeError(
      "A trusted selected Location is required for this inventory operation.",
      "INVENTORY_LOCATION_SCOPE_REQUIRED"
    );
  }

  if (!location) {
    return Object.freeze({ business });
  }

  if (!includeBusinessWide) {
    return Object.freeze({ business, location });
  }

  return Object.freeze({
    business,
    $or: [
      { location },
      { location: null },
      { location: { $exists: false } },
    ],
  });
}

export function assertInventoryResourceWithinScope(
  resource,
  tenantContext = {},
  { requireLocation = false, allowBusinessWide = false } = {}
) {
  const business = requireInventoryBusinessContext(tenantContext);
  const location = id(tenantContext.locationId);
  const resourceBusiness = id(resource?.business);
  const resourceLocation = id(resource?.location);

  if (!resource || !resourceBusiness || resourceBusiness !== business) {
    throw scopeError("Inventory resource not found.", "INVENTORY_RESOURCE_NOT_FOUND");
  }

  if (requireLocation && !location) {
    throw scopeError(
      "A trusted selected Location is required for this inventory operation.",
      "INVENTORY_LOCATION_SCOPE_REQUIRED"
    );
  }

  if (
    location &&
    resourceLocation &&
    resourceLocation !== location
  ) {
    throw scopeError("Inventory resource not found.", "INVENTORY_RESOURCE_NOT_FOUND");
  }

  if (location && !resourceLocation && !allowBusinessWide) {
    throw scopeError("Inventory resource not found.", "INVENTORY_RESOURCE_NOT_FOUND");
  }

  return true;
}

export function stripInventoryOwnershipInput(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const { business, location, businessId, locationId, tenantId, ...safe } = payload;
  void business;
  void location;
  void businessId;
  void locationId;
  void tenantId;
  return safe;
}
