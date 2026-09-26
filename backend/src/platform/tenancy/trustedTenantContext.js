import mongoose from "mongoose";

import BusinessMembership from "../../models/BusinessMembership.js";
import Location from "../../models/Location.js";
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

function optionalObjectId(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return normaliseObjectId(value, label);
}

async function findActiveMembership({
  userId,
  businessId,
}) {
  const filter = {
    user: userId,
    status: "active",
  };

  if (businessId) {
    filter.business = businessId;
  } else {
    filter.isDefault = true;
  }

  return BusinessMembership.findOne(filter);
}

async function findActiveLocation({
  locationId,
  businessId,
}) {
  return Location.findOne({
    _id: locationId,
    business: businessId,
    status: "active",
  });
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

  const locationAccessMode =
    membership.locationAccessMode === "all"
      ? "all"
      : "selected";

  const allowedLocationIds =
    locationAccessMode === "all"
      ? null
      : Object.freeze(
          [...new Set(
            (Array.isArray(membership.locations) ? membership.locations : [])
              .map((value) => String(value || "").trim())
              .filter((value) => mongoose.Types.ObjectId.isValid(value))
          )]
        );

  return Object.freeze({
    userId: normaliseObjectId(userId, "user"),
    businessId: normaliseTenantId(businessId),
    locationId: location
      ? normaliseObjectId(location, "location")
      : null,
    roleKey: String(membership.roleKey || "").trim().toLowerCase(),
    locationAccessMode,
    allowedLocationIds,
  });
}

/*
 * Resolve tenant context from an authenticated user and persisted membership.
 *
 * requestedBusinessId/requestedLocationId are selectors only. They never grant
 * authority: the selected business must have an active BusinessMembership for
 * the authenticated user, and a selected location must belong to that business
 * and be granted by the membership. When no business selector is supplied, an
 * active membership explicitly marked isDefault is required.
 *
 * Repository functions are injectable for deterministic isolation testing.
 */
export async function resolveTrustedTenantContext({
  authenticatedUser,
  requestedBusinessId = null,
  requestedLocationId = null,
  findMembership = findActiveMembership,
  findLocation = findActiveLocation,
}) {
  if (typeof findMembership !== "function" || typeof findLocation !== "function") {
    throw contextError(
      "Trusted tenant repositories are not configured.",
      "INVALID_TRUSTED_CONTEXT",
      500
    );
  }

  const userId = normaliseObjectId(authenticatedUser, "user");
  const selectedBusinessId = requestedBusinessId
    ? normaliseTenantId(requestedBusinessId)
    : null;

  const membership = await findMembership({
    userId,
    businessId: selectedBusinessId,
  });

  if (!membership) {
    throw contextError(
      selectedBusinessId
        ? "No active business membership grants access to the selected tenant."
        : "No active default business membership is available.",
      "TENANT_MEMBERSHIP_NOT_FOUND"
    );
  }

  const businessId = normaliseTenantId(membership.business);

  assertMembershipGrantsBusiness({
    membership,
    userId,
    businessId,
  });

  const selectedLocationId = optionalObjectId(
    requestedLocationId,
    "location"
  );

  let location = null;

  if (selectedLocationId) {
    location = await findLocation({
      locationId: selectedLocationId,
      businessId,
    });

    assertMembershipGrantsLocation({
      membership,
      location,
    });
  }

  return trustedTenantContext({
    membership,
    userId,
    businessId,
    location,
  });
}

export default trustedTenantContext;
