import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import StaffTimeOff, {
  STAFF_SCHEDULE_BLOCK_TYPES,
} from "../features/staff/StaffTimeOff.js";
import {
  staffScheduleLocationScope,
} from "./staffScheduleAuthorityService.js";

function scopeError(
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

function trustedBusinessId(authority) {
  const businessId = idText(
    authority?.businessId
  );

  if (!businessId) {
    throw scopeError(
      "Trusted effective authority is required for staff time-off scoping.",
      "STAFF_TIME_OFF_AUTHORITY_REQUIRED",
      401
    );
  }

  return businessId;
}

export function staffTimeOffStaffScope(
  authority,
  staffId = null
) {
  const businessId =
    trustedBusinessId(
      authority
    );

  const match = {
    business: businessId,
  };

  if (staffId) {
    if (!mongoose.isValidObjectId(staffId)) {
      throw scopeError(
        "staff must be a valid stylist identifier.",
        "INVALID_STAFF_ID",
        400
      );
    }

    match._id = staffId;
  }

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

export function staffTimeOffRecordScope(
  authority,
  scopedStaffIds
) {
  return staffScheduleLocationScope(
    authority,
    {
      includeBusinessWide: true,
      businessWideStaffIds:
        scopedStaffIds,
    }
  );
}

function parseDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw scopeError(
      `${fieldName} must be a valid date.`,
      "INVALID_TIME_OFF_DATE",
      400
    );
  }

  return date;
}

function normaliseBlockType(value) {
  const blockType = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_");

  if (
    !STAFF_SCHEDULE_BLOCK_TYPES.includes(
      blockType
    )
  ) {
    throw scopeError(
      "Schedule block type is invalid.",
      "INVALID_STAFF_SCHEDULE_BLOCK_TYPE",
      400
    );
  }

  return blockType;
}

export async function scopedTimeOffList(
  query = {},
  authority
) {
  const staffMatch =
    staffTimeOffStaffScope(
      authority,
      query.staff || null
    );

  const staff = await Stylist.find(
    staffMatch
  )
    .select("_id")
    .lean();

  if (
    query.staff &&
    staff.length === 0
  ) {
    throw scopeError(
      "The requested resource was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  const scopedStaffIds = staff.map(
    (entry) => entry._id
  );

  if (scopedStaffIds.length === 0) {
    return [];
  }

  const match = {
    ...staffTimeOffRecordScope(
      authority,
      scopedStaffIds
    ),
    staff: {
      $in: scopedStaffIds,
    },
  };

  if (query.status) {
    match.status = query.status;
  }

  if (query.blockType) {
    match.blockType =
      normaliseBlockType(
        query.blockType
      );
  }

  if (
    query.startDate ||
    query.endDate
  ) {
    const rangeStart =
      query.startDate
        ? parseDate(
            query.startDate,
            "startDate"
          )
        : new Date(0);
    const rangeEnd =
      query.endDate
        ? parseDate(
            query.endDate,
            "endDate"
          )
        : new Date(
            "9999-12-31T23:59:59.999Z"
          );

    match.startsAt = {
      $lte: rangeEnd,
    };
    match.endsAt = {
      $gte: rangeStart,
    };
  }

  return StaffTimeOff.find(match)
    .populate(
      "staff",
      "firstName lastName email isActive"
    )
    .populate(
      "approvedBy",
      "name email role"
    )
    .sort({ startsAt: 1 })
    .lean();
}

export default {
  scopedTimeOffList,
  staffTimeOffRecordScope,
  staffTimeOffStaffScope,
};
