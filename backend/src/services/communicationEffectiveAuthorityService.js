import {
  assertCommunicationResourceWithinScope,
  stripCommunicationOwnershipInput,
} from "./communicationOwnershipScope.js";

function scopeError(
  message,
  code = "COMMUNICATION_AUTHORITY_REQUIRED",
  statusCode = 403
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function idText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value
      ? value._id
      : value;

  return String(candidate ?? "").trim();
}

function uniqueIds(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map(idText)
        .filter(Boolean)
    ),
  ];
}

export function buildCommunicationEffectiveScope(
  effectiveAuthority
) {
  const businessId = idText(
    effectiveAuthority?.businessId
  );

  if (!businessId) {
    throw scopeError(
      "Trusted Business authority is required for communications access."
    );
  }

  const selectedLocationId =
    idText(effectiveAuthority?.locationId) || null;

  const allLocations =
    effectiveAuthority?.locationAccessMode === "all";

  const allowedLocationIds = allLocations
    ? null
    : uniqueIds(
        effectiveAuthority?.allowedLocationIds
      );

  if (
    !allLocations &&
    allowedLocationIds.length === 0
  ) {
    throw scopeError(
      "The active membership has no authorised communications Locations.",
      "COMMUNICATION_LOCATION_SCOPE_EMPTY"
    );
  }

  if (
    !allLocations &&
    selectedLocationId &&
    !allowedLocationIds.includes(
      selectedLocationId
    )
  ) {
    throw scopeError(
      "The selected Location is outside the active membership scope.",
      "COMMUNICATION_LOCATION_SCOPE_INVALID"
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
      allowedLocationIds === null
        ? null
        : Object.freeze([
            ...allowedLocationIds,
          ]),
    scopeMode,
  });
}

export function communicationBusinessAuthorityFilter(
  scope
) {
  if (!scope?.businessId) {
    throw scopeError(
      "A trusted communications scope is required."
    );
  }

  return Object.freeze({
    business: scope.businessId,
  });
}

export function communicationAggregateAuthorityFilter(
  scope,
  {
    includeBusinessWide = true,
  } = {}
) {
  const businessFilter = {
    ...communicationBusinessAuthorityFilter(
      scope
    ),
  };

  if (
    scope.scopeMode === "business-wide" &&
    scope.allLocations === true
  ) {
    return Object.freeze(
      businessFilter
    );
  }

  const allowedLocationIds =
    scope.scopeMode === "selected-location"
      ? [scope.selectedLocationId]
      : uniqueIds(
          scope.allowedLocationIds
        );

  if (allowedLocationIds.length === 0) {
    throw scopeError(
      "At least one trusted Location is required for communications access.",
      "COMMUNICATION_LOCATION_SCOPE_EMPTY"
    );
  }

  if (!includeBusinessWide) {
    return Object.freeze({
      ...businessFilter,
      location: Object.freeze({
        $in: Object.freeze([
          ...allowedLocationIds,
        ]),
      }),
    });
  }

  return Object.freeze({
    ...businessFilter,
    $or: Object.freeze([
      Object.freeze({
        location: Object.freeze({
          $in: Object.freeze([
            ...allowedLocationIds,
          ]),
        }),
      }),
      Object.freeze({ location: null }),
      Object.freeze({
        location: Object.freeze({
          $exists: false,
        }),
      }),
    ]),
  });
}

export function requireCommunicationMutationLocation(
  scope
) {
  if (
    scope?.scopeMode === "allowed-locations" &&
    !scope?.selectedLocationId
  ) {
    throw scopeError(
      "Select an authorised Location before performing this communications mutation.",
      "COMMUNICATION_SELECTED_LOCATION_REQUIRED"
    );
  }

  return scope?.selectedLocationId || null;
}

export function trustedCommunicationOwnership(
  scope,
  {
    requireSelectedLocation = false,
  } = {}
) {
  const business =
    communicationBusinessAuthorityFilter(
      scope
    ).business;

  const location = requireSelectedLocation
    ? requireCommunicationMutationLocation(
        scope
      )
    : scope?.selectedLocationId || null;

  return Object.freeze({
    business,
    location,
  });
}

export function assertCommunicationAuthorityResource(
  resource,
  scope,
  {
    allowBusinessWide = true,
    requireSelectedLocation = false,
  } = {}
) {
  const location = requireSelectedLocation
    ? requireCommunicationMutationLocation(
        scope
      )
    : scope?.selectedLocationId || null;

  assertCommunicationResourceWithinScope(
    resource,
    {
      businessId: scope?.businessId,
      locationId: location,
    },
    {
      requireLocation:
        requireSelectedLocation,
      allowBusinessWide,
    }
  );

  const resourceLocation = idText(
    resource?.location
  );

  if (
    !scope?.allLocations &&
    resourceLocation &&
    !uniqueIds(
      scope?.allowedLocationIds
    ).includes(resourceLocation)
  ) {
    throw scopeError(
      "Communication resource not found.",
      "COMMUNICATION_RESOURCE_NOT_FOUND",
      404
    );
  }

  return true;
}

export function sanitizeCommunicationPayload(
  payload = {}
) {
  const safe =
    stripCommunicationOwnershipInput(
      payload
    );

  if (
    safe.metadata &&
    typeof safe.metadata === "object" &&
    !Array.isArray(safe.metadata)
  ) {
    const {
      business,
      businessId,
      location,
      locationId,
      tenant,
      tenantId,
      ...metadata
    } = safe.metadata;

    void business;
    void businessId;
    void location;
    void locationId;
    void tenant;
    void tenantId;

    safe.metadata = metadata;
  }

  return safe;
}

export default {
  assertCommunicationAuthorityResource,
  buildCommunicationEffectiveScope,
  communicationAggregateAuthorityFilter,
  communicationBusinessAuthorityFilter,
  requireCommunicationMutationLocation,
  sanitizeCommunicationPayload,
  trustedCommunicationOwnership,
};
