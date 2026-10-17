import {
  assertBusinessResourceAuthority,
} from "./effectiveAuthorityService.js";

function authorityError(
  message,
  code,
  statusCode = 500
) {
  const error = new Error(
    message
  );
  error.code = code;
  error.statusCode =
    statusCode;
  return error;
}

function idText(value) {
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

function uniqueIds(values) {
  return [
    ...new Set(
      (
        Array.isArray(values)
          ? values
          : []
      )
        .map(idText)
        .filter(Boolean)
    ),
  ];
}

function assertAuthority(authority) {
  if (
    !authority ||
    !idText(
      authority.businessId
    )
  ) {
    throw authorityError(
      "Trusted staff account authority is required.",
      "STAFF_ACCOUNT_AUTHORITY_REQUIRED",
      401
    );
  }

  return authority;
}

function resourceNotFound() {
  return authorityError(
    "The requested resource was not found.",
    "RESOURCE_NOT_FOUND",
    404
  );
}

export function staffAccountBusinessId(
  authority
) {
  assertAuthority(
    authority
  );

  return idText(
    authority.businessId
  );
}

export function staffMembershipManagementFilter(
  authority,
  domainFilter = {}
) {
  assertAuthority(
    authority
  );

  if (
    !domainFilter ||
    typeof domainFilter !==
      "object" ||
    Array.isArray(
      domainFilter
    )
  ) {
    throw authorityError(
      "Staff membership filter must be an object.",
      "INVALID_STAFF_MEMBERSHIP_FILTER"
    );
  }

  const scope = {
    business:
      staffAccountBusinessId(
        authority
      ),
    status: {
      $ne:
        "revoked",
    },
  };

  if (
    authority.locationAccessMode !==
    "all"
  ) {
    const allowedLocationIds =
      uniqueIds(
        authority.allowedLocationIds
      );

    scope.locationAccessMode =
      "selected";
    scope.locations = {
      $in:
        allowedLocationIds,
    };
  }

  if (
    Object.keys(
      domainFilter
    ).length === 0
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

export function assertStaffMembershipAuthority(
  authority,
  membership
) {
  assertAuthority(
    authority
  );

  const businessId =
    idText(
      membership?.business
    );

  assertBusinessResourceAuthority(
    authority,
    businessId
  );

  if (
    String(
      membership?.status ||
      ""
    ) === "revoked"
  ) {
    throw resourceNotFound();
  }

  if (
    authority.locationAccessMode ===
    "all"
  ) {
    return Object.freeze({
      businessId,
      roleKey:
        String(
          membership?.roleKey ||
          ""
        ),
    });
  }

  if (
    membership?.locationAccessMode !==
    "selected"
  ) {
    throw resourceNotFound();
  }

  const allowed =
    new Set(
      uniqueIds(
        authority.allowedLocationIds
      )
    );
  const targetLocations =
    uniqueIds(
      membership?.locations
    );

  if (
    !targetLocations.some(
      (locationId) =>
        allowed.has(
          locationId
        )
    )
  ) {
    throw resourceNotFound();
  }

  return Object.freeze({
    businessId,
    roleKey:
      String(
        membership?.roleKey ||
        ""
      ),
  });
}

export function newStaffMembershipPayload({
  authority,
  userId,
  roleKey,
  workingLocationIds,
  actorId,
  isDefault = true,
} = {}) {
  assertAuthority(
    authority
  );

  const business =
    staffAccountBusinessId(
      authority
    );
  const locations =
    uniqueIds(
      workingLocationIds
    );
  const key =
    String(
      roleKey ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    !idText(userId) ||
    !/^[a-z][a-z0-9_]{2,39}$/.test(
      key
    ) ||
    locations.length === 0
  ) {
    throw authorityError(
      "Trusted Business, role and working-location ownership are required before enabling staff sign-in.",
      "INVALID_STAFF_MEMBERSHIP_OWNERSHIP",
      409
    );
  }

  return Object.freeze({
    user:
      idText(userId),
    business,
    status:
      "active",
    roleKey:
      key,
    locationAccessMode:
      "selected",
    locations:
      Object.freeze(
        locations
      ),
    isDefault:
      isDefault === true,
    createdBy:
      idText(actorId) ||
      null,
    updatedBy:
      idText(actorId) ||
      null,
  });
}

export default {
  assertStaffMembershipAuthority,
  newStaffMembershipPayload,
  staffAccountBusinessId,
  staffMembershipManagementFilter,
};
