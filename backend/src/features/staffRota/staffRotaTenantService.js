import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Stylist from "../../models/Stylist.js";
import StaffTimeOff from "../staff/StaffTimeOff.js";
import StaffAttendance from "./StaffAttendance.js";
import StaffShift from "./StaffShift.js";
import {
  calculateRotaMetrics,
  normaliseWeekStart,
} from "./staffRotaService.js";
import {
  staffScheduleCreationOwnership,
  staffScheduleLocationScope,
} from "../../services/staffScheduleAuthorityService.js";
import {
  createServiceError,
} from "../../shared/serviceError.js";
import {
  objectId,
  userId,
} from "../../shared/modelHelpers.js";

const DEFAULT_OVERTIME_MINUTES = 40 * 60;
const MAX_WEEK_RANGE_DAYS = 31;

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function idText(value) {
  const candidate = value && typeof value === "object" && "_id" in value
    ? value._id
    : value;
  return String(candidate || "").trim();
}

function allowedLocationIds(authority) {
  if (authority?.locationAccessMode === "all") {
    return null;
  }
  return [...new Set((authority?.allowedLocationIds || []).map(idText).filter(Boolean))];
}

function appointmentScope(authority) {
  const businessId = idText(authority?.businessId);
  if (!businessId) {
    throw createServiceError("Trusted rota authority is required.", 401);
  }

  const locations = allowedLocationIds(authority);
  if (locations === null) {
    return { business: businessId };
  }
  if (locations.length === 0) {
    return { business: businessId, _id: { $exists: false } };
  }
  return { business: businessId, location: { $in: locations } };
}

function stylistScope(authority) {
  const businessId = idText(authority?.businessId);
  if (!businessId) {
    throw createServiceError("Trusted rota authority is required.", 401);
  }

  const locations = allowedLocationIds(authority);
  if (locations === null) {
    return { business: businessId, isActive: { $ne: false } };
  }
  if (locations.length === 0) {
    return { business: businessId, _id: { $exists: false } };
  }
  return {
    business: businessId,
    isActive: { $ne: false },
    workingLocations: { $in: locations },
  };
}

function parseDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return date;
}

function shiftValues(payload = {}) {
  const startsAt = parseDate(payload.startsAt, "startsAt");
  const endsAt = parseDate(payload.endsAt, "endsAt");
  if (endsAt <= startsAt) {
    throw createServiceError("Shift end time must be after its start time.", 400, { field: "endsAt" });
  }

  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (durationMinutes > 18 * 60) {
    throw createServiceError("A staff shift cannot exceed 18 hours.", 400, { field: "endsAt" });
  }

  const breakMinutes = Number(payload.breakMinutes || 0);
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes >= durationMinutes) {
    throw createServiceError("Break minutes must be zero or greater and shorter than the shift.", 400, { field: "breakMinutes" });
  }

  const status = String(payload.status || "draft");
  if (!["draft", "published", "completed", "cancelled"].includes(status)) {
    throw createServiceError("Invalid shift status.", 400, { field: "status" });
  }

  return {
    startsAt,
    endsAt,
    breakMinutes: Math.round(breakMinutes),
    roleTitle: String(payload.roleTitle || "Stylist").trim(),
    location: String(payload.location || "Main salon").trim(),
    status,
    notes: String(payload.notes || "").trim(),
  };
}

export async function getTenantStaffRota(query = {}, authority) {
  const weekStart = normaliseWeekStart(query.startDate || new Date());
  const weekEnd = addDays(weekStart, 7);
  const requestedEnd = query.endDate ? parseDate(query.endDate, "endDate") : null;

  if (requestedEnd && (requestedEnd.getTime() - weekStart.getTime()) / 86_400_000 > MAX_WEEK_RANGE_DAYS) {
    throw createServiceError(`Rota queries cannot exceed ${MAX_WEEK_RANGE_DAYS} days.`, 400);
  }

  const overtimeThresholdMinutes = Math.max(
    Number(query.overtimeThresholdMinutes || DEFAULT_OVERTIME_MINUTES),
    60
  );
  const minimumStaff = Math.min(Math.max(Number(query.minimumStaff || 1), 1), 20);

  const shiftScope = staffScheduleLocationScope(authority, { locationField: "locationRef" });
  const timeOffScope = staffScheduleLocationScope(authority, { locationField: "location" });
  const staffMatch = stylistScope(authority);
  const appointmentMatch = appointmentScope(authority);

  const [staff, shifts, appointments, timeOff] = await Promise.all([
    Stylist.find(staffMatch)
      .select("firstName lastName email isActive workingHours workingLocations")
      .sort({ firstName: 1, lastName: 1 })
      .lean(),
    StaffShift.find({
      ...shiftScope,
      startsAt: { $lt: weekEnd },
      endsAt: { $gt: weekStart },
    })
      .populate("staff", "firstName lastName email isActive")
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .populate("publishedBy", "name email role")
      .sort({ startsAt: 1 })
      .lean(),
    Appointment.find({
      ...appointmentMatch,
      appointmentDate: { $gte: weekStart, $lt: weekEnd },
      status: { $nin: ["cancelled", "no_show"] },
    })
      .populate("stylist", "firstName lastName email")
      .populate("customer", "firstName lastName fullName name")
      .populate("service", "name duration")
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .lean(),
    StaffTimeOff.find({
      ...timeOffScope,
      status: "approved",
      startsAt: { $lt: weekEnd },
      endsAt: { $gt: weekStart },
    })
      .populate("staff", "firstName lastName email")
      .sort({ startsAt: 1 })
      .lean(),
  ]);

  const shiftIds = shifts.map((shift) => shift._id);
  const attendance = shiftIds.length
    ? await StaffAttendance.find({
        ...shiftScope,
        shift: { $in: shiftIds },
      })
        .populate("updatedBy", "name email role")
        .sort({ createdAt: 1 })
        .lean()
    : [];

  const metrics = calculateRotaMetrics({
    staff,
    shifts,
    attendance,
    appointments,
    timeOff,
    weekStart,
    overtimeThresholdMinutes,
    minimumStaff,
  });

  return {
    generatedAt: new Date(),
    weekStart,
    weekEnd: addDays(weekStart, 6),
    overtimeThresholdMinutes,
    minimumStaff,
    appointments,
    timeOff,
    ...metrics,
  };
}

export async function createTenantStaffShift(payload = {}, actor, authority) {
  const { businessId, locationId } = staffScheduleCreationOwnership(authority);
  const staffId = objectId(payload.staffId || payload.staff, "staffId");
  const values = shiftValues(payload);

  const stylist = await Stylist.findOne({
    _id: staffId,
    business: businessId,
    workingLocations: locationId,
    isActive: { $ne: false },
  }).lean();

  if (!stylist) {
    throw createServiceError("The requested resource was not found.", 404);
  }

  const [overlappingShift, overlappingTimeOff] = await Promise.all([
    StaffShift.findOne({
      business: businessId,
      locationRef: locationId,
      staff: staffId,
      status: { $ne: "cancelled" },
      startsAt: { $lt: values.endsAt },
      endsAt: { $gt: values.startsAt },
    }).lean(),
    StaffTimeOff.findOne({
      business: businessId,
      staff: staffId,
      status: "approved",
      startsAt: { $lt: values.endsAt },
      endsAt: { $gt: values.startsAt },
      $or: [
        { location: locationId },
        { location: null },
        { location: { $exists: false } },
      ],
    }).lean(),
  ]);

  if (overlappingShift) {
    throw createServiceError("This shift overlaps another shift for the selected stylist.", 409, { conflictType: "shift_overlap" });
  }
  if (overlappingTimeOff) {
    throw createServiceError("This shift overlaps approved staff time off.", 409, { conflictType: "approved_time_off" });
  }

  const actorId = userId(actor);
  const session = await mongoose.startSession();
  let createdShift;

  try {
    await session.withTransaction(async () => {
      const [shift] = await StaffShift.create([{
        business: businessId,
        locationRef: locationId,
        staff: staffId,
        ...values,
        createdBy: actorId,
        updatedBy: actorId,
        publishedAt: values.status === "published" ? new Date() : null,
        publishedBy: values.status === "published" ? actorId : null,
      }], { session });

      await StaffAttendance.create([{
        business: businessId,
        locationRef: locationId,
        shift: shift._id,
        staff: staffId,
        status: "scheduled",
        updatedBy: actorId,
      }], { session });

      createdShift = shift;
    });
  } finally {
    await session.endSession();
  }

  return createdShift.populate("staff", "firstName lastName email isActive");
}

export async function publishTenantStaffRotaWeek(startDate, actor, authority) {
  const weekStart = normaliseWeekStart(startDate || new Date());
  const weekEnd = addDays(weekStart, 7);
  const actorId = userId(actor);
  const publishedAt = new Date();
  const scope = staffScheduleLocationScope(authority, { locationField: "locationRef" });

  const result = await StaffShift.updateMany(
    {
      ...scope,
      startsAt: { $gte: weekStart, $lt: weekEnd },
      status: "draft",
    },
    {
      $set: {
        status: "published",
        publishedAt,
        publishedBy: actorId,
        updatedBy: actorId,
      },
    }
  );

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    published: result.modifiedCount || 0,
  };
}

export default {
  getTenantStaffRota,
  createTenantStaffShift,
  publishTenantStaffRotaWeek,
};
