import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import StaffTimeOff from "../features/staff/StaffTimeOff.js";
import {
  assertStaffScheduleRecordAuthority,
  staffScheduleCreationOwnership,
} from "./staffScheduleAuthorityService.js";
import { userId } from "../shared/modelHelpers.js";

function mutationError(
  message,
  code,
  statusCode,
  details = undefined
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function parseDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw mutationError(
      `${fieldName} must be a valid date.`,
      "INVALID_TIME_OFF_DATE",
      400,
      { field: fieldName }
    );
  }

  return date;
}

function validateWindow(payload = {}) {
  const startsAt =
    parseDate(
      payload.startsAt,
      "startsAt"
    );
  const endsAt =
    parseDate(
      payload.endsAt,
      "endsAt"
    );

  if (endsAt <= startsAt) {
    throw mutationError(
      "Schedule block end must be after its start.",
      "INVALID_TIME_OFF_WINDOW",
      400
    );
  }

  return {
    startsAt,
    endsAt,
  };
}

export function staffTimeOffCreationScope(
  authority,
  staffId
) {
  if (!mongoose.isValidObjectId(staffId)) {
    throw mutationError(
      "staffId must be a valid stylist identifier.",
      "INVALID_STAFF_ID",
      400,
      { field: "staffId" }
    );
  }

  const ownership =
    staffScheduleCreationOwnership(
      authority,
      {
        allowBusinessWide: true,
      }
    );

  const staffMatch = {
    _id: staffId,
    business:
      ownership.businessId,
  };

  if (ownership.locationId) {
    staffMatch.workingLocations =
      ownership.locationId;
  }

  return Object.freeze({
    businessId:
      String(ownership.businessId),
    locationId:
      ownership.locationId
        ? String(ownership.locationId)
        : null,
    staffMatch:
      Object.freeze(staffMatch),
  });
}

export async function createScopedTimeOff(
  staffId,
  payload = {},
  authority
) {
  const scope =
    staffTimeOffCreationScope(
      authority,
      staffId
    );

  const stylist =
    await Stylist.findOne(
      scope.staffMatch
    )
      .select("_id")
      .lean();

  if (!stylist) {
    throw mutationError(
      "The requested resource was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  const {
    startsAt,
    endsAt,
  } = validateWindow(payload);

  return StaffTimeOff.create({
    business:
      scope.businessId,
    location:
      scope.locationId || undefined,
    staff:
      stylist._id,
    startsAt,
    endsAt,
    blockType:
      "time_off",
    title: "",
    reason:
      String(payload.reason || "")
        .trim()
        .slice(0, 500),
    status:
      "requested",
  });
}

export async function scopedTimeOffRecord(
  id,
  authority
) {
  if (!mongoose.isValidObjectId(id)) {
    throw mutationError(
      "Time-off request identifier is invalid.",
      "INVALID_TIME_OFF_ID",
      400,
      { field: "id" }
    );
  }

  const record =
    await StaffTimeOff.findOne({
      _id: id,
      business:
        authority?.businessId,
    })
      .lean();

  if (!record) {
    throw mutationError(
      "The requested resource was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  const stylist =
    await Stylist.findOne({
      _id: record.staff,
      business:
        authority?.businessId,
    })
      .select("workingLocations")
      .lean();

  if (!stylist) {
    throw mutationError(
      "The requested resource was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  assertStaffScheduleRecordAuthority(
    authority,
    record,
    {
      allowBusinessWide: true,
      staffWorkingLocationIds:
        stylist.workingLocations || [],
    }
  );

  return record;
}

export async function updateScopedTimeOffStatus(
  id,
  status,
  user,
  authority
) {
  const allowed = [
    "requested",
    "approved",
    "declined",
    "cancelled",
  ];

  if (!allowed.includes(status)) {
    throw mutationError(
      "Invalid time-off status.",
      "INVALID_TIME_OFF_STATUS",
      400
    );
  }

  await scopedTimeOffRecord(
    id,
    authority
  );

  const request =
    await StaffTimeOff.findOne({
      _id: id,
      business:
        authority.businessId,
    });

  if (!request) {
    throw mutationError(
      "The requested resource was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  request.status = status;
  request.approvedBy =
    status === "approved"
      ? userId(user)
      : undefined;

  await request.save();
  return request.toObject();
}

export default {
  createScopedTimeOff,
  scopedTimeOffRecord,
  staffTimeOffCreationScope,
  updateScopedTimeOffStatus,
};
