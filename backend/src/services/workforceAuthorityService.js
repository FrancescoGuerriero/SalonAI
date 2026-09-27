import {
  assertBusinessResourceAuthority,
  hasLocationAuthority,
} from "./effectiveAuthorityService.js";

function scopeError(
  message,
  code,
  statusCode = 500
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

function uniqueIds(
  values
) {
  return [
    ...new Set(
      (
        Array.isArray(
          values
        )
          ? values
          : []
      )
        .map(
          idText
        )
        .filter(
          Boolean
        )
    ),
  ];
}

function assertAuthority(
  authority
) {
  if (
    !authority ||
    !idText(
      authority.businessId
    )
  ) {
    throw scopeError(
      "Trusted effective authority is required for workforce scoping.",
      "WORKFORCE_AUTHORITY_REQUIRED",
      401
    );
  }

  return authority;
}

function resourceNotFound() {
  return scopeError(
    "The requested resource was not found.",
    "RESOURCE_NOT_FOUND",
    404
  );
}

export function publicWorkforceBusinessId(
  request
) {
  const businessId =
    idText(
      request
        ?.publicTenantContext
        ?.businessId
    );

  if (!businessId) {
    throw scopeError(
      "The requested tenant is unavailable.",
      "PUBLIC_TENANT_NOT_FOUND",
      404
    );
  }

  return businessId;
}

export function workforceManagementScope(
  authority
) {
  assertAuthority(
    authority
  );

  const businessId =
    idText(
      authority.businessId
    );

  if (
    authority.locationAccessMode ===
    "all"
  ) {
    return {
      business:
        businessId,
    };
  }

  const allowedLocationIds =
    uniqueIds(
      authority.allowedLocationIds
    );

  return {
    business:
      businessId,
    workingLocations: {
      $in:
        allowedLocationIds,
    },
  };
}

export function scopedWorkforceFilter(
  authority,
  domainFilter = {}
) {
  if (
    !domainFilter ||
    typeof domainFilter !==
      "object" ||
    Array.isArray(
      domainFilter
    )
  ) {
    throw scopeError(
      "Workforce domain filter must be an object.",
      "INVALID_WORKFORCE_FILTER"
    );
  }

  const scope =
    workforceManagementScope(
      authority
    );

  if (
    Object.keys(
      domainFilter
    ).length ===
    0
  ) {
    return scope;
  }

  return {
    $and: [
      scope,
      domainFilter,
    ],
  };
}

export function workforceCreationOwnership(
  authority
) {
  assertAuthority(
    authority
  );

  const businessId =
    idText(
      authority.businessId
    );
  const selectedLocationId =
    idText(
      authority.locationId
    );

  if (
    selectedLocationId &&
    hasLocationAuthority(
      authority,
      selectedLocationId
    )
  ) {
    return Object.freeze({
      businessId,
      workingLocationIds:
        Object.freeze([
          selectedLocationId,
        ]),
    });
  }

  if (
    authority.locationAccessMode ===
    "selected"
  ) {
    const allowedLocationIds =
      uniqueIds(
        authority.allowedLocationIds
      );

    if (
      allowedLocationIds.length ===
      1
    ) {
      return Object.freeze({
        businessId,
        workingLocationIds:
          Object.freeze([
            allowedLocationIds[0],
          ]),
      });
    }
  }

  throw scopeError(
    "A trusted working location must be selected before creating a workforce record.",
    "WORKFORCE_LOCATION_CONTEXT_REQUIRED",
    403
  );
}

export function assertWorkforceResourceAuthority(
  authority,
  workforceRecord,
  {
    requireSelectedLocation =
      false,
  } = {}
) {
  assertAuthority(
    authority
  );

  const businessId =
    idText(
      workforceRecord?.business
    );

  assertBusinessResourceAuthority(
    authority,
    businessId
  );

  const workingLocationIds =
    uniqueIds(
      workforceRecord
        ?.workingLocations
    );

  if (
    authority.locationAccessMode ===
    "all"
  ) {
    if (
      requireSelectedLocation
    ) {
      const selectedLocationId =
        idText(
          authority.locationId
        );

      if (
        !selectedLocationId ||
        !workingLocationIds.includes(
          selectedLocationId
        )
      ) {
        throw resourceNotFound();
      }
    }

    return Object.freeze({
      businessId,
      workingLocationIds:
        Object.freeze(
          workingLocationIds
        ),
    });
  }

  const allowedLocationIds =
    new Set(
      uniqueIds(
        authority.allowedLocationIds
      )
    );

  if (
    requireSelectedLocation
  ) {
    const selectedLocationId =
      idText(
        authority.locationId
      );

    if (
      !selectedLocationId ||
      !allowedLocationIds.has(
        selectedLocationId
      ) ||
      !workingLocationIds.includes(
        selectedLocationId
      )
    ) {
      throw resourceNotFound();
    }
  } else {
    const intersects =
      workingLocationIds.some(
        (locationId) =>
          allowedLocationIds.has(
            locationId
          )
      );

    if (!intersects) {
      throw resourceNotFound();
    }
  }

  return Object.freeze({
    businessId,
    workingLocationIds:
      Object.freeze(
        workingLocationIds
      ),
  });
}

export default {
  assertWorkforceResourceAuthority,
  publicWorkforceBusinessId,
  scopedWorkforceFilter,
  workforceCreationOwnership,
  workforceManagementScope,
};
