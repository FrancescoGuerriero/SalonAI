import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Stylist from "../../models/Stylist.js";
import StaffAvailability from "./StaffAvailability.js";
import StaffTimeOff from "./StaffTimeOff.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  startOfDay,
  endOfDay,
} from "../../shared/dateUtils.js";
import { userId } from "../../shared/modelHelpers.js";

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

function parseDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createServiceError(
      `${fieldName} must be a valid date.`,
      400,
      { field: fieldName }
    );
  }

  return date;
}

function timeToMinutes(value, fieldName) {
  const time = String(value || "").trim();

  if (!TIME_PATTERN.test(time)) {
    throw createServiceError(
      `${fieldName} must use HH:mm format.`,
      400,
      { field: fieldName }
    );
  }

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function validateRanges(ranges = []) {
  if (!Array.isArray(ranges)) {
    throw createServiceError(
      "Availability ranges must be an array.",
      400,
      { field: "ranges" }
    );
  }

  const normalised = ranges.map((range, index) => {
    const start = String(range?.start || "").trim();
    const end = String(range?.end || "").trim();
    const startMinutes = timeToMinutes(start, `ranges[${index}].start`);
    const endMinutes = timeToMinutes(end, `ranges[${index}].end`);

    if (endMinutes <= startMinutes) {
      throw createServiceError(
        "Each availability range must end after it starts.",
        400,
        { field: `ranges[${index}]` }
      );
    }

    return { start, end, startMinutes, endMinutes };
  });

  normalised.sort((left, right) => left.startMinutes - right.startMinutes);

  for (let index = 1; index < normalised.length; index += 1) {
    if (normalised[index].startMinutes < normalised[index - 1].endMinutes) {
      throw createServiceError(
        "Availability ranges must not overlap.",
        400,
        { field: "ranges" }
      );
    }
  }

  return normalised.map(({ start, end }) => ({ start, end }));
}

async function requireStylist(staffId) {
  if (!mongoose.isValidObjectId(staffId)) {
    throw createServiceError(
      "staffId must be a valid stylist identifier.",
      400,
      { field: "staffId" }
    );
  }

  return assertFound(
    await Stylist.findById(staffId),
    "Stylist not found."
  );
}

function effectiveAvailabilityMatch(staffId, target) {
  return {
    staff: staffId,
    dayOfWeek: target.getDay(),
    active: true,
    $and: [
      {
        $or: [
          { effectiveFrom: null },
          { effectiveFrom: { $lte: target } },
        ],
      },
      {
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: target } },
        ],
      },
    ],
  };
}

function fallbackRanges(stylist, target) {
  const dayName = DAY_NAMES[target.getDay()];
  const workingDay = stylist.workingHours?.find(
    (entry) => entry.day === dayName
  );

  if (!workingDay || workingDay.available === false) {
    return [];
  }

  return validateRanges([
    {
      start: workingDay.start || "09:00",
      end: workingDay.end || "17:00",
    },
  ]);
}

function appointmentMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export async function setWeeklyAvailability(staffId, payload = {}) {
  await requireStylist(staffId);

  const dayOfWeek = Number(payload.dayOfWeek);

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw createServiceError(
      "dayOfWeek must be between 0 and 6.",
      400,
      { field: "dayOfWeek" }
    );
  }

  const ranges = validateRanges(payload.ranges || []);

  return StaffAvailability.findOneAndUpdate(
    {
      staff: staffId,
      dayOfWeek,
      effectiveFrom: payload.effectiveFrom || null,
    },
    {
      $set: {
        ranges,
        active: payload.active === undefined ? true : Boolean(payload.active),
        effectiveFrom: payload.effectiveFrom || null,
        effectiveTo: payload.effectiveTo || null,
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

export async function weeklyAvailability(staffId) {
  await requireStylist(staffId);

  return StaffAvailability.find({ staff: staffId })
    .sort({ dayOfWeek: 1, effectiveFrom: -1 })
    .lean();
}

export async function dayAvailability(staffId, date) {
  const target = parseDate(date, "date");
  const stylist = await requireStylist(staffId);

  const [configuredAvailability, appointments, timeOff] = await Promise.all([
    StaffAvailability.findOne(
      effectiveAvailabilityMatch(staffId, target)
    ).lean(),
    Appointment.find({
      stylist: staffId,
      appointmentDate: {
        $gte: startOfDay(target),
        $lte: endOfDay(target),
      },
      status: { $nin: ["cancelled", "no_show"] },
    })
      .populate("service", "name duration")
      .populate("customer", "firstName lastName fullName name")
      .sort({ appointmentTime: 1 })
      .lean(),
    StaffTimeOff.find({
      staff: staffId,
      status: "approved",
      startsAt: { $lte: endOfDay(target) },
      endsAt: { $gte: startOfDay(target) },
    }).lean(),
  ]);

  const ranges = configuredAvailability?.ranges?.length
    ? configuredAvailability.ranges
    : fallbackRanges(stylist, target);

  return {
    date: target,
    availability: configuredAvailability || {
      staff: stylist._id,
      dayOfWeek: target.getDay(),
      ranges,
      active: ranges.length > 0,
      source: "stylist_working_hours",
    },
    appointments,
    timeOff,
    available: ranges.length > 0 && timeOff.length === 0,
  };
}

export async function assertAppointmentWithinStaffAvailability(
  staffId,
  startsAt,
  endsAt
) {
  const start = parseDate(startsAt, "startsAt");
  const end = parseDate(endsAt, "endsAt");

  if (end <= start) {
    throw createServiceError(
      "Appointment end time must be after its start time.",
      400
    );
  }

  if (start.toDateString() !== end.toDateString()) {
    throw createServiceError(
      "Appointments must start and finish on the same day.",
      409
    );
  }

  const stylist = await requireStylist(staffId);

  if (stylist.isActive === false) {
    throw createServiceError(
      "The selected stylist is inactive.",
      409
    );
  }

  const [configuredAvailability, timeOff] = await Promise.all([
    StaffAvailability.findOne(
      effectiveAvailabilityMatch(staffId, start)
    ).lean(),
    StaffTimeOff.findOne({
      staff: staffId,
      status: "approved",
      startsAt: { $lt: end },
      endsAt: { $gt: start },
    }).lean(),
  ]);

  if (timeOff) {
    throw createServiceError(
      "The selected stylist is unavailable because approved time off overlaps this appointment.",
      409,
      { timeOff }
    );
  }

  const ranges = configuredAvailability?.ranges?.length
    ? validateRanges(configuredAvailability.ranges)
    : fallbackRanges(stylist, start);

  const startMinutes = appointmentMinutes(start);
  const endMinutes = appointmentMinutes(end);
  const isInsideWorkingRange = ranges.some((range) => {
    const rangeStart = timeToMinutes(range.start, "range.start");
    const rangeEnd = timeToMinutes(range.end, "range.end");
    return startMinutes >= rangeStart && endMinutes <= rangeEnd;
  });

  if (!isInsideWorkingRange) {
    throw createServiceError(
      "The requested appointment is outside the stylist's working hours.",
      409,
      { ranges }
    );
  }

  return {
    available: true,
    source: configuredAvailability
      ? "configured_availability"
      : "stylist_working_hours",
    ranges,
  };
}

export async function requestTimeOff(staffId, payload = {}) {
  await requireStylist(staffId);

  const startsAt = parseDate(payload.startsAt, "startsAt");
  const endsAt = parseDate(payload.endsAt, "endsAt");

  if (endsAt <= startsAt) {
    throw createServiceError(
      "Time-off end must be after its start.",
      400
    );
  }

  return StaffTimeOff.create({
    staff: staffId,
    startsAt,
    endsAt,
    reason: String(payload.reason || "").trim(),
    status: payload.status || "requested",
  });
}

export async function updateTimeOff(id, status, user) {
  const allowed = [
    "requested",
    "approved",
    "declined",
    "cancelled",
  ];

  if (!allowed.includes(status)) {
    throw createServiceError(
      "Invalid time-off status.",
      400
    );
  }

  const request = assertFound(
    await StaffTimeOff.findById(id),
    "Time-off request not found."
  );

  request.status = status;
  request.approvedBy = status === "approved" ? userId(user) : undefined;

  await request.save();
  return request.toObject();
}

export async function listTimeOff(query = {}) {
  const match = {};

  if (query.staff) {
    await requireStylist(query.staff);
    match.staff = query.staff;
  }

  if (query.status) {
    match.status = query.status;
  }

  return StaffTimeOff.find(match)
    .populate("staff", "firstName lastName email isActive")
    .populate("approvedBy", "name email role")
    .sort({ startsAt: 1 })
    .lean();
}
