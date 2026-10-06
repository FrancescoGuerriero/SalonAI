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
        .filter(Boolean)
    ),
  ];
}

function assertAuthority(
  authority
) {
  const businessId =
    idText(
      authority?.businessId
    );

  if (!businessId) {
    throw scopeError(
      "Trusted effective authority is required for staff schedule scoping.",
      "STAFF_SCHEDULE_AUTHORITY_REQUIRED",
      401
    );
  }

  return {
    authority,
    businessId,
  };
}

function resourceNotFound() {
  return scopeError(
    "The requested resource was not found.",
    "RESOURCE_NOT_FOUND",
    404
  );
}

function locationValue(
  record,
  locationField
) {
  return idText(
    record?.[
      locationField
    ]
  );
}

export function staffScheduleBusinessScope(
  authority
) {
  const {
    businessId,
  } =
    assertAuthority(
      authority
    );

  return Object.freeze({
    business:
      businessId,
  });
}

export function staffScheduleLocationScope(
  authority,
  {
    locationField =
      "location",
    includeBusinessWide =
      false,
  } = {}
) {
  const {
    authority:
      trustedAuthority,
    businessId,
  } =
    assertAuthority(
      authority
    );

  if (
    trustedAuthority.locationAccessMode ===
    "all"
  ) {
    return {
      business:
        businessId,
    };
  }

  const allowedLocationIds =
    uniqueIds(
      trustedAuthority.allowedLocationIds
    );

  if (
    allowedLocationIds.length ===
    0
  ) {
    return {
      business:
        businessId,
      _id: {
        $exists:
          false,
      },
    };
  }

  const locationFilter =
    includeBusinessWide
      ? {
          $or: [
            {
              [locationField]: {
                $in:
                  allowedLocationIds,
              },
            },
            {
              [locationField]:
                null,
            },
            {
              [locationField]: {
                $exists:
                  false,
              },
            },
          ],
        }
      : {
          [locationField]: {
            $in:
              allowedLocationIds,
          },
        };

  return {
    business:
      businessId,
    ...locationFilter,
  };
}

export function staffScheduleCreationOwnership(
  authority,
  {
    allowBusinessWide =
      false,
  } = {}
) {
  const {
    authority:
      trustedAuthority,
    businessId,
  } =
    assertAuthority(
      authority
    );

  const locationId =
    idText(
      trustedAuthority.locationId
    );

  if (
    locationId &&
    hasLocationAuthority(
      trustedAuthority,
      locationId
    )
  ) {
    return Object.freeze({
      businessId,
      locationId,
    });
  }

  if (
    allowBusinessWide &&
    trustedAuthority.locationAccessMode ===
      "all"
  ) {
    return Object.freeze({
      businessId,
      locationId:
        null,
    });
  }

  throw scopeError(
    "A trusted active location is required for this staff schedule operation.",
    "STAFF_SCHEDULE_LOCATION_CONTEXT_REQUIRED",
    403
  );
}

export function assertStaffScheduleRecordAuthority(
  authority,
  record,
  {
    locationField =
      "location",
    allowBusinessWide =
      false,
    requireSelectedLocation =
      false,
  } = {}
) {
  const {
    authority:
      trustedAuthority,
    businessId:
      trustedBusinessId,
  } =
    assertAuthority(
      authority
    );

  const recordBusinessId =
    idText(
      record?.business
    );

  assertBusinessResourceAuthority(
    trustedAuthority,
    recordBusinessId
  );

  const recordLocationId =
    locationValue(
      record,
      locationField
    );

  if (
    !recordLocationId
  ) {
    if (
      allowBusinessWide &&
      trustedAuthority.locationAccessMode ===
        "all"
    ) {
      return Object.freeze({
        businessId:
          trustedBusinessId,
        locationId:
          null,
      });
    }

    if (
      allowBusinessWide &&
      !requireSelectedLocation
    ) {
      return Object.freeze({
        businessId:
          trustedBusinessId,
        locationId:
          null,
      });
    }

    throw resourceNotFound();
  }

  if (
    !hasLocationAuthority(
      trustedAuthority,
      recordLocationId
    )
  ) {
    throw resourceNotFound();
  }

  if (
    requireSelectedLocation &&
    idText(
      trustedAuthority.locationId
    ) !== recordLocationId
  ) {
    throw resourceNotFound();
  }

  return Object.freeze({
    businessId:
      trustedBusinessId,
    locationId:
      recordLocationId,
  });
}

export function assertAppointmentBackedScheduleScope(
  authority
) {
  const {
    authority:
      trustedAuthority,
    businessId,
  } =
    assertAuthority(
      authority
    );

  if (
    trustedAuthority.locationAccessMode !==
    "all"
  ) {
    throw scopeError(
      "Selected-location schedule views that include appointment data require trusted Appointment location ownership.",
      "APPOINTMENT_LOCATION_SCOPE_REQUIRED",
      409
    );
  }

  return Object.freeze({
    businessId,
    allowed:
      true,
  });
}

export default {
  assertAppointmentBackedScheduleScope,
  assertStaffScheduleRecordAuthority,
  staffScheduleBusinessScope,
  staffScheduleCreationOwnership,
  staffScheduleLocationScope,
};
