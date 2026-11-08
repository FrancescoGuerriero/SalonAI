import mongoose from "mongoose";

/**
 * Fail-closed ownership predicates for the canonical Commerce collections.
 * This is a source/acceptance primitive, NOT endpoint activation.
 * Never derive businessId or allowedLocationIds from untrusted client input.
 */
export function commerceTenantFilter(effectiveAuthority, { locationId = null } = {}) {
  const businessId = String(effectiveAuthority?.businessId || "");
  if (!mongoose.isValidObjectId(businessId)) {
    const error = new Error("A valid trusted Business is required for Commerce.");
    error.code = "COMMERCE_TENANT_CONTEXT_REQUIRED";
    error.statusCode = 403;
    throw error;
  }

  const accessMode = effectiveAuthority?.locationAccessMode;
  if (accessMode !== "all" && accessMode !== "selected") {
    const error = new Error("Verified Commerce location authority is required.");
    error.code = "COMMERCE_LOCATION_AUTHORITY_REQUIRED";
    error.statusCode = 403;
    throw error;
  }

  const requested = locationId == null ? null : String(locationId);
  if (requested && !mongoose.isValidObjectId(requested)) {
    const error = new Error("Invalid Commerce location.");
    error.code = "COMMERCE_LOCATION_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }

  if (accessMode === "all") {
    return {
      business: new mongoose.Types.ObjectId(businessId),
      ...(requested ? { location: new mongoose.Types.ObjectId(requested) } : {}),
    };
  }

  const allowed = (effectiveAuthority.allowedLocationIds || [])
    .map(String)
    .filter((value) => mongoose.isValidObjectId(value));
  if (!allowed.length || (requested && !allowed.includes(requested))) {
    const error = new Error("Commerce location not found.");
    error.code = "COMMERCE_LOCATION_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }

  return {
    business: new mongoose.Types.ObjectId(businessId),
    location: requested
      ? new mongoose.Types.ObjectId(requested)
      : { $in: allowed.map((value) => new mongoose.Types.ObjectId(value)) },
  };
}
