import mongoose from "mongoose";

import {
  normaliseTenantId,
} from "./tenantScope.js";

function contextError(message, code, statusCode = 404) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normaliseObjectId(value, label) {
  const candidate =
    value && typeof value === "object" && "_id" in value
      ? value._id
      : value;

  const text = String(candidate || "").trim();

  if (!mongoose.Types.ObjectId.isValid(text)) {
    throw contextError(
      `A valid ${label} id is required.`,
      "INVALID_TRUSTED_CONTEXT",
      400
    );
  }

  return text;
}

export function assertMembershipGrantsBusiness({
  membership,
  userId,
  businessId,
}) {
  const trustedUserId = normaliseObjectId(userId, "user");
  const trustedBusinessId = normaliseTenantId(businessId);

  if (
    !membership ||
    membership.status !== "active" ||
    String(membership.user || "") !== trustedUserId ||
    String(membership.business || "") !== trustedBusinessId
  ) {
    throw contextError(
      "No active business membership grants access to this tenant.",
      "TENANT_MEMBERSHIP_NOT_FOUND"
    );
  }

  return membership;
}

export function assertMembershipGrantsLocation({
  membership,
  location,
}) {
  if (!membership || membership.status !== "active") {
    throw contextError(
      "An active business membership is required.",
      "TENANT_MEMBERSHIP_NOT_FOUND"
    );
  }

  if (!location) {
    throw contextError(
      "The requested location is unavailable.",
      "TENANT_LOCATION_NOT_FOUND"
    );
  }

  const membershipBusinessId = normaliseTenantId(membership.business);
  const locationBusinessId = normaliseTenantId(location.business);

  if (membershipBusinessId !== locationBusinessId) {
    throw contextError(
      "The requested location does not belong to the active business.",
      "TENANT_LOCATION_NOT_FOUND"
    );
  }

  if (membership.locationAccessMode === "all") {
    return location;
  }

  const locationId = normaliseObjectId(location, "location");
  const allowedLocations = new Set(
    (Array.isArray(membership.locations) ? membership.locations : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );

  if (!allowedLocations.has(locationId)) {
    throw contextError(
      "The active membership does not grant access to this location.",
      "TENANT_LOCATION_NOT_FOUND"
    );
  }

  return location;
}

export function trustedTenantContext({
  membership,
  userId,
  businessId,
  location = null,
}) {
  assertMembershipGrantsBusiness({
    membership,
    userId,
    businessId,
  });

  if (location) {
    assertMembershipGrantsLocation({
      membership,
      location,
    });
  }

  return Object.freeze({
    userId: normaliseObjectId(userId, "user"),
    businessId: normaliseTenantId(businessId),
    locationId: location
      ? normaliseObjectId(location, "location")
      : null,
    roleKey: String(membership.roleKey || "").trim().toLowerCase(),
  });
}

export default trustedTenantContext;
