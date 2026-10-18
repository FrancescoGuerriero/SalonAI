import Stylist from "../models/Stylist.js";
import StaffAvailability from "../features/staff/StaffAvailability.js";
import {
  scopedWorkforceFilter,
} from "./workforceAuthorityService.js";
import {
  staffScheduleCreationOwnership,
} from "./staffScheduleAuthorityService.js";
import {
  setScopedWeeklyAvailability,
} from "./staffAvailabilityMutationService.js";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function serviceError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function timeToMinutes(value, fieldName) {
  const time = String(value || "").trim();
  if (!TIME_PATTERN.test(time)) {
    throw serviceError(
      `${fieldName} must use HH:mm format.`,
      "INVALID_AVAILABILITY_TIME",
      400
    );
  }
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function fallbackRangesForDay(stylist, dayOfWeek) {
  const dayName = DAY_NAMES[Number(dayOfWeek)];
  const workingDay = stylist.workingHours?.find(
    (entry) => entry.day === dayName
  );

  if (!workingDay || workingDay.available === false) {
    return [];
  }

  const start = workingDay.start || "09:00";
  const end = workingDay.end || "17:00";
  const dayStart = timeToMinutes(start, "workingHours.start");
  const dayEnd = timeToMinutes(end, "workingHours.end");

  const breaks = (workingDay.breaks || [])
    .map((entry, index) => ({
      start: String(entry?.start || "").trim(),
      end: String(entry?.end || "").trim(),
      startMinutes: timeToMinutes(
        entry?.start,
        `workingHours.breaks[${index}].start`
      ),
      endMinutes: timeToMinutes(
        entry?.end,
        `workingHours.breaks[${index}].end`
      ),
    }))
    .filter(
      (entry) =>
        entry.endMinutes > entry.startMinutes &&
        entry.startMinutes >= dayStart &&
        entry.endMinutes <= dayEnd
    )
    .sort((left, right) => left.startMinutes - right.startMinutes);

  const ranges = [];
  let cursor = dayStart;
  let cursorLabel = start;

  for (const pause of breaks) {
    if (pause.startMinutes < cursor) continue;
    if (pause.startMinutes > cursor) {
      ranges.push({ start: cursorLabel, end: pause.start });
    }
    cursor = pause.endMinutes;
    cursorLabel = pause.end;
  }

  if (cursor < dayEnd) {
    ranges.push({ start: cursorLabel, end });
  }

  return ranges;
}

async function ownedAvailabilityStylist(userId, authority) {
  const ownership = staffScheduleCreationOwnership(authority);

  const stylist = await Stylist.findOne(
    scopedWorkforceFilter(
      authority,
      {
        userAccount: userId,
        workingLocations: ownership.locationId,
      }
    )
  )
    .select(
      "_id business workingLocations firstName lastName email isActive workingHours"
    )
    .lean();

  if (!stylist) {
    throw serviceError(
      "The requested resource was not found.",
      "RESOURCE_NOT_FOUND",
      404
    );
  }

  return {
    stylist,
    ownership,
  };
}

export async function scopedSelfWeeklyAvailability(
  userId,
  authority
) {
  const {
    stylist,
    ownership,
  } = await ownedAvailabilityStylist(
    userId,
    authority
  );

  const configured = await StaffAvailability.find({
    business: ownership.businessId,
    location: ownership.locationId,
    staff: stylist._id,
  })
    .sort({
      dayOfWeek: 1,
      effectiveFrom: -1,
    })
    .lean();

  const items = Array.from(
    { length: 7 },
    (_, dayOfWeek) => {
      const matching = configured.filter(
        (entry) => Number(entry.dayOfWeek) === dayOfWeek
      );
      const base =
        matching.find((entry) => !entry.effectiveFrom) ||
        matching[0];

      if (base) {
        return {
          ...base,
          source: "configured_availability",
        };
      }

      const ranges = fallbackRangesForDay(
        stylist,
        dayOfWeek
      );

      return {
        business: ownership.businessId,
        location: ownership.locationId,
        staff: stylist._id,
        dayOfWeek,
        ranges,
        active: ranges.length > 0,
        effectiveFrom: null,
        effectiveTo: null,
        source: "stylist_working_hours",
      };
    }
  );

  return {
    staff: stylist,
    items,
  };
}

export async function setScopedSelfWeeklyAvailability(
  userId,
  payload,
  authority
) {
  const { stylist } = await ownedAvailabilityStylist(
    userId,
    authority
  );

  return setScopedWeeklyAvailability(
    stylist._id,
    payload,
    authority
  );
}

export default {
  scopedSelfWeeklyAvailability,
  setScopedSelfWeeklyAvailability,
};
