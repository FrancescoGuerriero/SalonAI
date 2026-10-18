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

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(id).filter(Boolean))];
}

export function resolveInventoryAuthority(authority = {}) {
  const businessId = id(authority.businessId);
  if (!businessId) {
    throw scopeError(
      "Trusted Business context is required for inventory/purchasing access."
    );
  }

  const selectedLocationId = id(authority.locationId);
  const allLocations = authority.locationAccessMode === "all";
  let allowedLocationIds = allLocations ? null : uniqueIds(authority.allowedLocationIds);

  // Compatibility with transitional trusted tenant contexts that expose only a
  // selected location. Effective authority remains the preferred runtime input.
  if (!allLocations && allowedLocationIds.length === 0 && selectedLocationId) {
    allowedLocationIds = [selectedLocationId];
  }

  if (!allLocations && allowedLocationIds.length === 0) {
    throw scopeError(
      "The active membership has no authorised inventory locations.",
      "INVENTORY_LOCATION_SCOPE_EMPTY"
    );
  }

  if (
    !allLocations &&
    selectedLocationId &&
    !allowedLocationIds.includes(selectedLocationId)
  ) {
    throw scopeError(
      "The selected Location is outside the active membership scope.",
      "INVENTORY_LOCATION_SCOPE_INVALID"
    );
  }

  const scopeMode = selectedLocationId
    ? "selected-location"
    : allLocations
      ? "business-wide"
      : "allowed-locations";

  return Object.freeze({
    businessId,
    selectedLocationId,
    allLocations,
    allowedLocationIds:
      allowedLocationIds === null ? null : Object.freeze([...allowedLocationIds]),
    scopeMode,
  });
}

export function requireInventoryBusinessContext(authority = {}) {
  return resolveInventoryAuthority(authority).businessId;
}

export function inventoryBusinessFilter(authority = {}) {
  const scope = resolveInventoryAuthority(authority);
  return Object.freeze({ business: scope.businessId });
}

export function inventoryLocationFilter(
  authority = {},
  { requireSelectedLocation = false, includeBusinessWide = false } = {}
) {
  const scope = resolveInventoryAuthority(authority);
  const base = { business: scope.businessId };

  if (requireSelectedLocation && !scope.selectedLocationId) {
    throw scopeError(
      "A trusted selected Location is required for this inventory operation.",
      "INVENTORY_LOCATION_SCOPE_REQUIRED"
    );
  }

  if (scope.selectedLocationId) {
    if (!includeBusinessWide) {
      return Object.freeze({ ...base, location: scope.selectedLocationId });
    }
    return Object.freeze({
      ...base,
      $or: Object.freeze([
        Object.freeze({ location: scope.selectedLocationId }),
        Object.freeze({ location: null }),
        Object.freeze({ location: Object.freeze({ $exists: false }) }),
      ]),
    });
  }

  if (scope.allLocations) {
    return Object.freeze(base);
  }

  if (!includeBusinessWide) {
    return Object.freeze({
      ...base,
      location: Object.freeze({ $in: Object.freeze([...scope.allowedLocationIds]) }),
    });
  }

  return Object.freeze({
    ...base,
    $or: Object.freeze([
      Object.freeze({
        location: Object.freeze({ $in: Object.freeze([...scope.allowedLocationIds]) }),
      }),
      Object.freeze({ location: null }),
      Object.freeze({ location: Object.freeze({ $exists: false }) }),
    ]),
  });
}

export function assertInventoryResourceWithinScope(
  resource,
  authority = {},
  { requireLocation = false, allowBusinessWide = false } = {}
) {
  const scope = resolveInventoryAuthority(authority);
  const resourceBusiness = id(resource?.business);
  const resourceLocation = id(resource?.location);

  if (!resource || !resourceBusiness || resourceBusiness !== scope.businessId) {
    throw scopeError("Inventory resource not found.", "INVENTORY_RESOURCE_NOT_FOUND");
  }

  if (requireLocation && !resourceLocation) {
    throw scopeError("Inventory resource not found.", "INVENTORY_RESOURCE_NOT_FOUND");
  }

  if (!resourceLocation) {
    if (allowBusinessWide) return true;
    throw scopeError("Inventory resource not found.", "INVENTORY_RESOURCE_NOT_FOUND");
  }

  if (scope.selectedLocationId && resourceLocation !== scope.selectedLocationId) {
    throw scopeError("Inventory resource not found.", "INVENTORY_RESOURCE_NOT_FOUND");
  }

  if (
    !scope.allLocations &&
    !scope.allowedLocationIds.includes(resourceLocation)
  ) {
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
