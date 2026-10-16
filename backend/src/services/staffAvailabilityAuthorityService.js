import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import StaffAvailability from "../features/staff/StaffAvailability.js";
import {
  staffScheduleLocationScope,
} from "./staffScheduleAuthorityService.js";

function authorityError(
  message,
  code,
  statusCode
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function idText(value) {
  return String(value || "").trim();
}

function allowedLocationIds(authority) {
  return [
    ...new Set(
      (Array.isArray(authority?.allowedLocationIds)
        ? authority.allowedLocationIds
        : [])
        .map(idText)
        .filter(Boolean)
    ),
  ];
}

export function staffAvailabilityStaffScope(
  authority,
  staffId
) {
  const businessId = idText(
    authority?.businessId
  );

  if (!businessId) {
    throw authorityError(
      "Trusted effective authority is required for staff availability scoping.",
      "STAFF_AVAILABILITY_AUTHORITY_REQUIRED",
      401
    );
  }

  if (!mongoose.isValidObjectId(staffId)) {
    throw authorityError(
      "staffId must be a valid stylist identifier.",
      "INVALID_STAFF_ID",
      400
    );
  }

  const match = {
    _id: staffId,
    business: businessId,
  };

  if (
    authority.locationAccessMode !==
    "all"
  ) {
    const locations =
      allowedLocationIds(
        authority
      );

    if (
      locations.length === 0
    ) {
      return {
        ...match,
        _id: {
          $exists: false,
        },
      };
    }

    match.workingLocations = {
      $in: locations,
    };
  }

  return match;
}

export async function scopedWeeklyAvailability(
  staffId,
  authority
) {
  const stylist =
    await Stylist.findOne(
      staffAvailabilityStaffScope(
        authority,
        staffId
      )
    )
      .select("_id")
      .lean();

  if (!stylist) {
    throw authorityError(
      "The requested resource was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  return StaffAvailability.find({
    ...staffScheduleLocationScope(
      authority
    ),
    staff: stylist._id,
  })
    .sort({
      dayOfWeek: 1,
      effectiveFrom: -1,
    })
    .lean();
}

export default {
  scopedWeeklyAvailability,
  staffAvailabilityStaffScope,
};
