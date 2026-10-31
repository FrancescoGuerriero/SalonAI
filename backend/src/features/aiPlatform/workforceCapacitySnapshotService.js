import mongoose from "mongoose";

import Stylist from "../../models/Stylist.js";
import WorkforceCapacitySnapshot from "../../models/WorkforceCapacitySnapshot.js";

const SOURCE_VERSION = "workforce-capacity-v1";
const DAY_NAMES = Object.freeze([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

function asText(value) {
  return String(value || "").trim();
}

function asUtcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid businessDate is required.");
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}

function parseMinutes(value) {
  const match = asText(value).match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function mergedBreakMinutes(breaks, shiftStart, shiftEnd) {
  const intervals = (Array.isArray(breaks) ? breaks : [])
    .map((item) => {
      const breakStart = parseMinutes(item?.start);
      const breakEnd = parseMinutes(item?.end);
      if (
        breakStart === null ||
        breakEnd === null ||
        breakEnd <= breakStart
      ) {
        return null;
      }

      const start = Math.max(shiftStart, breakStart);
      const end = Math.min(shiftEnd, breakEnd);
      return end > start ? [start, end] : null;
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);

  if (!intervals.length) {
    return 0;
  }

  let total = 0;
  let [currentStart, currentEnd] = intervals[0];

  for (const [start, end] of intervals.slice(1)) {
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
      continue;
    }

    total += currentEnd - currentStart;
    currentStart = start;
    currentEnd = end;
  }

  return total + currentEnd - currentStart;
}

export function workingMinutesForDay(workingHours, dayName) {
  const entry = (Array.isArray(workingHours) ? workingHours : []).find(
    (item) => asText(item?.day) === dayName
  );

  if (!entry || entry.available === false) {
    return 0;
  }

  const start = parseMinutes(entry.start);
  const end = parseMinutes(entry.end);
  if (start === null || end === null || end <= start) {
    return 0;
  }

  const breakMinutes = mergedBreakMinutes(
    entry.breaks,
    start,
    end
  );

  return Math.max(0, end - start - breakMinutes);
}

export function buildWorkforceCapacitySnapshot({
  businessId,
  locationId,
  businessDate,
  stylists,
} = {}) {
  const business = asText(businessId);
  const location = asText(locationId);
  const date = asUtcDay(businessDate);

  if (!mongoose.Types.ObjectId.isValid(business)) {
    throw new Error("A valid businessId is required.");
  }
  if (!mongoose.Types.ObjectId.isValid(location)) {
    throw new Error("A valid locationId is required.");
  }

  const dayName = DAY_NAMES[date.getUTCDay()];
  const eligible = (Array.isArray(stylists) ? stylists : []).filter(
    (stylist) =>
      stylist?.isActive === true &&
      stylist?.acceptsAppointments === true &&
      asText(stylist?.business) === business &&
      (Array.isArray(stylist?.workingLocations)
        ? stylist.workingLocations.some(
            (value) => asText(value) === location
          )
        : false)
  );

  const availableMinutes = eligible.reduce(
    (total, stylist) =>
      total + workingMinutesForDay(stylist.workingHours, dayName),
    0
  );

  return {
    business,
    location,
    businessDate: date,
    availableStaffHours: Number((availableMinutes / 60).toFixed(2)),
    eligibleStaffCount: eligible.length,
    appointmentCapacity: 0,
    sourceType: "recurring_working_hours",
    sourceVersion: SOURCE_VERSION,
    sourceRefs: eligible.map((stylist) => ({
      collection: Stylist.collection.name,
      documentId: asText(stylist._id),
    })),
    generatedAt: new Date(),
    metadata: {
      dayName,
      aggregateOnly: true,
      historicalBackfillAuthorised: false,
      appointmentCapacityPolicy: "not_derived_without_approved_productivity_policy",
    },
  };
}

export async function captureWorkforceCapacitySnapshot({
  businessId,
  locationId,
  businessDate,
  apply = false,
} = {}) {
  const business = asText(businessId);
  const location = asText(locationId);
  const date = asUtcDay(businessDate);
  const today = asUtcDay(new Date());

  if (date.getTime() < today.getTime()) {
    const error = new Error(
      "Recurring working hours cannot be backfilled as historical workforce capacity evidence."
    );
    error.code = "AI_WORKFORCE_HISTORICAL_BACKFILL_BLOCKED";
    throw error;
  }

  const stylists = await Stylist.find({
    business,
    workingLocations: location,
    isActive: true,
    acceptsAppointments: true,
  })
    .select(
      "_id business workingLocations isActive acceptsAppointments workingHours"
    )
    .lean();

  const snapshot = buildWorkforceCapacitySnapshot({
    businessId: business,
    locationId: location,
    businessDate: date,
    stylists,
  });

  if (!apply) {
    return {
      ...snapshot,
      apply: false,
    };
  }

  const saved = await WorkforceCapacitySnapshot.findOneAndUpdate(
    {
      business,
      location,
      businessDate: date,
    },
    snapshot,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return {
    ...saved,
    apply: true,
  };
}

export default {
  workingMinutesForDay,
  buildWorkforceCapacitySnapshot,
  captureWorkforceCapacitySnapshot,
};
