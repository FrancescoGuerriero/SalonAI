import mongoose from "mongoose";

function scopeError(
  message,
  code = "AI_TENANT_SCOPE_REQUIRED"
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function objectIdText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value
      ? value._id
      : value;
  const text = String(candidate || "").trim();

  return mongoose.isValidObjectId(text)
    ? text
    : "";
}

export function normaliseAiTenantScope({
  businessId,
  locationId = null,
  locationAccessMode = "selected",
  allowedLocationIds = [],
} = {}) {
  const business = objectIdText(businessId);

  if (!business) {
    throw scopeError(
      "Trusted Business context is required for tenant-aware AI operations."
    );
  }

  const selectedLocation = locationId
    ? objectIdText(locationId)
    : "";

  if (locationId && !selectedLocation) {
    throw scopeError(
      "Trusted Location context is invalid.",
      "INVALID_AI_LOCATION_SCOPE"
    );
  }

  const mode =
    locationAccessMode === "all"
      ? "all"
      : "selected";
  const allowed = Array.from(
    new Set(
      (Array.isArray(allowedLocationIds)
        ? allowedLocationIds
        : [])
        .map(objectIdText)
        .filter(Boolean)
    )
  );

  if (
    selectedLocation &&
    mode === "selected" &&
    !allowed.includes(selectedLocation)
  ) {
    throw scopeError(
      "The selected Location is outside the trusted membership scope.",
      "AI_LOCATION_SCOPE_MISMATCH"
    );
  }

  return Object.freeze({
    businessId: business,
    locationId: selectedLocation || null,
    locationAccessMode: mode,
    allowedLocationIds:
      mode === "all"
        ? null
        : Object.freeze(allowed),
  });
}

export function buildAiTenantFilter(
  scopeInput,
  {
    businessField = "business",
    locationField = "location",
  } = {}
) {
  const scope = normaliseAiTenantScope(scopeInput);
  const filter = {
    [businessField]: scope.businessId,
  };

  if (scope.locationId) {
    filter[locationField] = scope.locationId;
  } else if (
    scope.locationAccessMode === "selected"
  ) {
    filter[locationField] = {
      $in: scope.allowedLocationIds,
    };
  }

  return {
    scope,
    filter,
  };
}

export default {
  buildAiTenantFilter,
  normaliseAiTenantScope,
};
