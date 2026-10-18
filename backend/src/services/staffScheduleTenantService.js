import mongoose from "mongoose";

import Appointment from "../models/Appointment.js";
import Stylist from "../models/Stylist.js";
import StaffAvailability from "../features/staff/StaffAvailability.js";
import StaffTimeOff, {
  STAFF_SCHEDULE_BLOCK_TYPES,
} from "../features/staff/StaffTimeOff.js";
import {
  salonDateAnchor,
  salonDayBounds,
  salonDayOfWeek,
} from "../shared/salonTime.js";
import { userId } from "../shared/modelHelpers.js";
import {
  scopedTimeOffList,
} from "./staffTimeOffAuthorityService.js";
import {
  scopedTimeOffRecord,
  updateScopedTimeOffStatus,
} from "./staffTimeOffMutationService.js";
import {
  staffScheduleCreationOwnership,
} from "./staffScheduleAuthorityService.js";

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function serviceError(message, code, statusCode, details) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details !== undefined) error.details = details;
  return error;
}

function parseDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw serviceError(`${field} must be a valid date.`, "INVALID_SCHEDULE_DATE", 400, { field });
  }
  return date;
}

function fallbackRanges(stylist, dayOfWeek) {
  const workingDay = stylist.workingHours?.find(
    (entry) => entry.day === DAY_NAMES[Number(dayOfWeek)]
  );
  if (!workingDay || workingDay.available === false) return [];

  const start = String(workingDay.start || "09:00");
  const end = String(workingDay.end || "17:00");
  const minutes = (value) => {
    const [hours, mins] = String(value).split(":").map(Number);
    return hours * 60 + mins;
  };
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);
  const breaks = (workingDay.breaks || [])
    .map((entry) => ({
      start: String(entry?.start || ""),
      end: String(entry?.end || ""),
      startMinutes: minutes(entry?.start),
      endMinutes: minutes(entry?.end),
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.startMinutes) &&
        Number.isFinite(entry.endMinutes) &&
        entry.endMinutes > entry.startMinutes &&
        entry.startMinutes >= startMinutes &&
        entry.endMinutes <= endMinutes
    )
    .sort((left, right) => left.startMinutes - right.startMinutes);

  const ranges = [];
  let cursor = startMinutes;
  let cursorLabel = start;
  for (const pause of breaks) {
    if (pause.startMinutes < cursor) continue;
    if (pause.startMinutes > cursor) ranges.push({ start: cursorLabel, end: pause.start });
    cursor = pause.endMinutes;
    cursorLabel = pause.end;
  }
  if (cursor < endMinutes) ranges.push({ start: cursorLabel, end });
  return ranges;
}

async function scopedStylist(staffId, authority, { userAccount = null } = {}) {
  if (staffId && !mongoose.isValidObjectId(staffId)) {
    throw serviceError("staffId must be a valid stylist identifier.", "INVALID_STAFF_ID", 400);
  }
  const ownership = staffScheduleCreationOwnership(authority);
  const match = {
    business: ownership.businessId,
    workingLocations: ownership.locationId,
    isActive: { $ne: false },
  };
  if (staffId) match._id = staffId;
  if (userAccount) match.userAccount = userAccount;

  const stylist = await Stylist.findOne(match)
    .select("_id business workingLocations firstName lastName email isActive workingHours")
    .lean();
  if (!stylist) {
    throw serviceError("The requested resource was not found.", "RESOURCE_NOT_FOUND", 404);
  }
  return { stylist, ownership };
}

async function tenantDayForStylist(stylist, ownership, date) {
  const target = salonDateAnchor(date);
  const { start: dayStart, end: dayEnd } = salonDayBounds(target);
  const dayOfWeek = salonDayOfWeek(target);

  const availabilityMatch = {
    business: ownership.businessId,
    location: ownership.locationId,
    staff: stylist._id,
    dayOfWeek,
    active: true,
    $and: [
      { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: target } }] },
      { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: target } }] },
    ],
  };

  const [configuredAvailability, appointments, timeOff] = await Promise.all([
    StaffAvailability.findOne(availabilityMatch).lean(),
    Appointment.find({
      business: ownership.businessId,
      location: ownership.locationId,
      stylist: stylist._id,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["cancelled", "no_show"] },
    })
      .populate("service", "name duration")
      .populate("customer", "firstName lastName fullName name")
      .sort({ appointmentTime: 1 })
      .lean(),
    StaffTimeOff.find({
      business: ownership.businessId,
      staff: stylist._id,
      status: "approved",
      startsAt: { $lte: dayEnd },
      endsAt: { $gte: dayStart },
      $or: [
        { location: ownership.locationId },
        { location: null },
        { location: { $exists: false } },
      ],
    }).lean(),
  ]);

  const ranges = configuredAvailability?.ranges?.length
    ? configuredAvailability.ranges
    : fallbackRanges(stylist, dayOfWeek);

  return {
    date: target,
    availability: configuredAvailability || {
      business: ownership.businessId,
      location: ownership.locationId,
      staff: stylist._id,
      dayOfWeek,
      ranges,
      active: ranges.length > 0,
      source: "stylist_working_hours",
    },
    appointments,
    timeOff,
    available: ranges.length > 0 && timeOff.length === 0,
  };
}

export async function scopedStaffDay(staffId, date, authority) {
  const { stylist, ownership } = await scopedStylist(staffId, authority);
  return tenantDayForStylist(stylist, ownership, date);
}

export async function scopedSelfDay(userAccount, date, authority) {
  const { stylist, ownership } = await scopedStylist(null, authority, { userAccount });
  return tenantDayForStylist(stylist, ownership, date);
}

function blockLabel(block) {
  if (["time_off", "personal"].includes(block?.blockType || "time_off")) return "Unavailable";
  return String(block?.title || "").trim() || ({ meeting: "Meeting", training: "Training", other: "Blocked time" }[block?.blockType] || "Blocked time");
}

export async function scopedCalendarBlocks(query, authority) {
  const records = await scopedTimeOffList(
    { ...query, status: "approved" },
    authority
  );
  return records.map((record) => ({
    _id: record._id,
    staff: record.staff,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    blockType: record.blockType,
    title: blockLabel(record),
    status: record.status,
  }));
}

export async function createScopedCalendarBlock(staffId, payload = {}, actor, authority) {
  const { stylist, ownership } = await scopedStylist(staffId, authority);
  const startsAt = parseDate(payload.startsAt, "startsAt");
  const endsAt = parseDate(payload.endsAt, "endsAt");
  if (endsAt <= startsAt) {
    throw serviceError("Schedule block end must be after its start.", "INVALID_SCHEDULE_WINDOW", 400);
  }

  const blockType = String(payload.blockType || "other").trim().toLowerCase().replaceAll("-", "_");
  if (!STAFF_SCHEDULE_BLOCK_TYPES.includes(blockType)) {
    throw serviceError("Schedule block type is invalid.", "INVALID_STAFF_SCHEDULE_BLOCK_TYPE", 400);
  }

  const [appointmentConflict, blockConflict] = await Promise.all([
    Appointment.findOne({
      business: ownership.businessId,
      location: ownership.locationId,
      stylist: stylist._id,
      status: { $nin: ["cancelled", "no_show"] },
      $or: [
        { startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } },
        { appointmentDate: { $gte: startsAt, $lte: endsAt } },
      ],
    }).lean(),
    StaffTimeOff.findOne({
      business: ownership.businessId,
      staff: stylist._id,
      status: "approved",
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
      $or: [
        { location: ownership.locationId },
        { location: null },
        { location: { $exists: false } },
      ],
    }).lean(),
  ]);

  if (appointmentConflict || blockConflict) {
    throw serviceError("The schedule block overlaps an existing appointment or schedule block.", "SCHEDULE_BLOCK_CONFLICT", 409);
  }

  return StaffTimeOff.create({
    business: ownership.businessId,
    location: ownership.locationId,
    staff: stylist._id,
    startsAt,
    endsAt,
    blockType,
    title: String(payload.title || "").trim().slice(0, 120),
    reason: String(payload.reason || "").trim().slice(0, 500),
    status: "approved",
    approvedBy: userId(actor),
  });
}

export async function cancelScopedCalendarBlock(id, actor, authority) {
  const record = await scopedTimeOffRecord(id, authority);
  if (record.status !== "approved") {
    throw serviceError("The requested resource was not found.", "RESOURCE_NOT_FOUND", 404);
  }
  return updateScopedTimeOffStatus(id, "cancelled", actor, authority);
}

export default {
  cancelScopedCalendarBlock,
  createScopedCalendarBlock,
  scopedCalendarBlocks,
  scopedSelfDay,
  scopedStaffDay,
};
