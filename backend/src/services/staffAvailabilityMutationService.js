import mongoose from "mongoose";

import Stylist from "../models/Stylist.js";
import StaffAvailability from "../features/staff/StaffAvailability.js";
import {
  staffScheduleCreationOwnership,
} from "./staffScheduleAuthorityService.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function serviceError(
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

function validateRanges(ranges = []) {
  if (!Array.isArray(ranges)) {
    throw serviceError(
      "Availability ranges must be an array.",
      "INVALID_AVAILABILITY_RANGES",
      400,
      { field: "ranges" }
    );
  }

  const normalised = ranges.map((range, index) => {
    const start = String(range?.start || "").trim();
    const end = String(range?.end || "").trim();

    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
      throw serviceError(
        "Availability ranges must use HH:mm format.",
        "INVALID_AVAILABILITY_TIME",
        400,
        { field: `ranges[${index}]` }
      );
    }

    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (endMinutes <= startMinutes) {
      throw serviceError(
        "Each availability range must end after it starts.",
        "INVALID_AVAILABILITY_RANGE",
        400,
        { field: `ranges[${index}]` }
      );
    }

    return {
      start,
      end,
      startMinutes,
      endMinutes,
    };
  });

  normalised.sort(
    (left, right) =>
      left.startMinutes - right.startMinutes
  );

  for (let index = 1; index < normalised.length; index += 1) {
    if (
      normalised[index].startMinutes <
      normalised[index - 1].endMinutes
    ) {
      throw serviceError(
        "Availability ranges must not overlap.",
        "OVERLAPPING_AVAILABILITY_RANGES",
        400,
        { field: "ranges" }
      );
    }
  }

  return normalised.map(({ start, end }) => ({
    start,
    end,
  }));
}

export function staffAvailabilityMutationScope(
  authority,
  staffId
) {
  if (!mongoose.isValidObjectId(staffId)) {
    throw serviceError(
      "staffId must be a valid stylist identifier.",
      "INVALID_STAFF_ID",
      400,
      { field: "staffId" }
    );
  }

  const ownership =
    staffScheduleCreationOwnership(
      authority
    );

  return Object.freeze({
    businessId:
      String(ownership.businessId),
    locationId:
      String(ownership.locationId),
    staffMatch: Object.freeze({
      _id: staffId,
      business:
        ownership.businessId,
      workingLocations:
        ownership.locationId,
    }),
  });
}

export async function setScopedWeeklyAvailability(
  staffId,
  payload = {},
  authority
) {
  const scope =
    staffAvailabilityMutationScope(
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
    throw serviceError(
      "The requested resource was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  const dayOfWeek =
    Number(payload.dayOfWeek);

  if (
    !Number.isInteger(dayOfWeek) ||
    dayOfWeek < 0 ||
    dayOfWeek > 6
  ) {
    throw serviceError(
      "dayOfWeek must be between 0 and 6.",
      "INVALID_DAY_OF_WEEK",
      400,
      { field: "dayOfWeek" }
    );
  }

  const ranges =
    validateRanges(
      payload.ranges || []
    );
  const effectiveFrom =
    payload.effectiveFrom || null;

  return StaffAvailability.findOneAndUpdate(
    {
      business:
        scope.businessId,
      location:
        scope.locationId,
      staff:
        stylist._id,
      dayOfWeek,
      effectiveFrom,
    },
    {
      $set: {
        business:
          scope.businessId,
        location:
          scope.locationId,
        staff:
          stylist._id,
        ranges,
        active:
          payload.active === undefined
            ? true
            : Boolean(payload.active),
        effectiveFrom,
        effectiveTo:
          payload.effectiveTo || null,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

export default {
  setScopedWeeklyAvailability,
  staffAvailabilityMutationScope,
};
