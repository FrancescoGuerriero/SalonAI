function scopeError(message, code = "REPORT_EXPORT_SCOPE_REQUIRED", statusCode = 403) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function idText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value ? value._id : value;
  return String(candidate || "").trim();
}

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(idText).filter(Boolean))];
}

export function buildReportExportTenantScope(effectiveAuthority) {
  const businessId = idText(effectiveAuthority?.businessId);
  if (!businessId) {
    throw scopeError("Trusted Business authority is required for reports and exports.");
  }

  const selectedLocationId = idText(effectiveAuthority?.locationId) || null;
  const allLocations = effectiveAuthority?.locationAccessMode === "all";
  const allowedLocationIds = allLocations
    ? null
    : uniqueIds(effectiveAuthority?.allowedLocationIds);

  if (!allLocations && allowedLocationIds.length === 0) {
    throw scopeError(
      "The active membership has no authorised reporting locations.",
      "REPORT_EXPORT_LOCATION_SCOPE_EMPTY"
    );
  }

  if (
    !allLocations &&
    selectedLocationId &&
    !allowedLocationIds.includes(selectedLocationId)
  ) {
    throw scopeError(
      "The selected Location is outside the active membership scope.",
      "REPORT_EXPORT_LOCATION_SCOPE_INVALID"
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
    allowedLocationIds:
      allowedLocationIds === null ? null : Object.freeze([...allowedLocationIds]),
    allLocations,
    scopeMode,
  });
}

export function reportExportBusinessFilter(scope) {
  if (!scope?.businessId) {
    throw scopeError("A trusted report/export scope is required.");
  }
  return Object.freeze({ business: scope.businessId });
}

export function reportExportLocationFilter(scope) {
  const base = { ...reportExportBusinessFilter(scope) };

  if (scope.scopeMode === "selected-location") {
    if (!scope.selectedLocationId) {
      throw scopeError(
        "Selected-location reporting requires a trusted Location.",
        "REPORT_EXPORT_SELECTED_LOCATION_REQUIRED"
      );
    }
    return Object.freeze({ ...base, location: scope.selectedLocationId });
  }

  if (scope.scopeMode === "allowed-locations") {
    const allowedLocationIds = uniqueIds(scope.allowedLocationIds);
    if (allowedLocationIds.length === 0) {
      throw scopeError(
        "Allowed-location reporting requires at least one trusted Location.",
        "REPORT_EXPORT_LOCATION_SCOPE_EMPTY"
      );
    }
    return Object.freeze({
      ...base,
      location: Object.freeze({ $in: Object.freeze(allowedLocationIds) }),
    });
  }

  if (scope.scopeMode === "business-wide" && scope.allLocations === true) {
    return Object.freeze(base);
  }

  throw scopeError(
    "The report/export location scope is invalid.",
    "REPORT_EXPORT_LOCATION_SCOPE_INVALID"
  );
}

export default {
  buildReportExportTenantScope,
  reportExportBusinessFilter,
  reportExportLocationFilter,
};
