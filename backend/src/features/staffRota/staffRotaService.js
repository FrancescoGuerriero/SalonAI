import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Stylist from "../../models/Stylist.js";
import StaffTimeOff from "../staff/StaffTimeOff.js";
import StaffAttendance from "./StaffAttendance.js";
import StaffShift from "./StaffShift.js";

import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  addDays,
  endOfDay,
  startOfDay,
} from "../../shared/dateUtils.js";
import {
  objectId,
  userId,
} from "../../shared/modelHelpers.js";

const ACTIVE_SHIFT_STATUSES = [
  "draft",
  "published",
  "completed",
];

const ACTIVE_APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
];

const DEFAULT_OVERTIME_MINUTES = 40 * 60;
const MAX_WEEK_RANGE_DAYS = 31;

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

function parseOptionalDate(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parseDate(value, fieldName);
}

export function normaliseWeekStart(value = new Date()) {
  const date = parseDate(value, "startDate");
  date.setHours(0, 0, 0, 0);

  const day = date.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + difference);

  return date;
}

function localDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function displayName(record, fallback = "Staff member") {
  if (!record) {
    return fallback;
  }

  return (
    record.fullName ||
    record.name ||
    [record.firstName, record.lastName]
      .filter(Boolean)
      .join(" ") ||
    fallback
  );
}

export function shiftScheduledMinutes(shift) {
  const startsAt = new Date(shift?.startsAt);
  const endsAt = new Date(shift?.endsAt);

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    return 0;
  }

  const grossMinutes =
    (endsAt.getTime() - startsAt.getTime()) / 60_000;

  return Math.max(
    Math.round(grossMinutes - Number(shift?.breakMinutes || 0)),
    0
  );
}

export function attendanceWorkedMinutes(attendance) {
  if (!attendance?.clockInAt || !attendance?.clockOutAt) {
    return 0;
  }

  const clockInAt = new Date(attendance.clockInAt);
  const clockOutAt = new Date(attendance.clockOutAt);

  if (
    Number.isNaN(clockInAt.getTime()) ||
    Number.isNaN(clockOutAt.getTime()) ||
    clockOutAt <= clockInAt
  ) {
    return 0;
  }

  return Math.max(
    Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60_000),
    0
  );
}

function appointmentWindow(appointment) {
  let startsAt = appointment?.startsAt
    ? new Date(appointment.startsAt)
    : null;

  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    startsAt = appointment?.appointmentDate
      ? new Date(appointment.appointmentDate)
      : null;

    if (startsAt && !Number.isNaN(startsAt.getTime())) {
      const [hours = 0, minutes = 0] = String(
        appointment?.appointmentTime || "00:00"
      )
        .split(":")
        .map(Number);

      startsAt.setHours(hours, minutes, 0, 0);
    }
  }

  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return { startsAt: null, endsAt: null };
  }

  let endsAt = appointment?.endsAt
    ? new Date(appointment.endsAt)
    : null;

  if (!endsAt || Number.isNaN(endsAt.getTime())) {
    endsAt = new Date(
      startsAt.getTime() +
        Math.max(Number(appointment?.duration || 60), 1) * 60_000
    );
  }

  return { startsAt, endsAt };
}

function intervalOverlaps(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function validateShiftPayload(payload = {}, existing = null) {
  const startsAt = parseDate(
    payload.startsAt ?? existing?.startsAt,
    "startsAt"
  );

  const endsAt = parseDate(
    payload.endsAt ?? existing?.endsAt,
    "endsAt"
  );

  if (endsAt <= startsAt) {
    throw createServiceError(
      "Shift end time must be after its start time.",
      400,
      { field: "endsAt" }
    );
  }

  const grossMinutes =
    (endsAt.getTime() - startsAt.getTime()) / 60_000;

  if (grossMinutes > 18 * 60) {
    throw createServiceError(
      "A staff shift cannot exceed 18 hours.",
      400,
      { field: "endsAt" }
    );
  }

  const breakMinutes = Number(
    payload.breakMinutes ?? existing?.breakMinutes ?? 0
  );

  if (
    !Number.isFinite(breakMinutes) ||
    breakMinutes < 0 ||
    breakMinutes >= grossMinutes
  ) {
    throw createServiceError(
      "Break minutes must be zero or greater and shorter than the shift.",
      400,
      { field: "breakMinutes" }
    );
  }

  const allowedStatuses = [
    "draft",
    "published",
    "completed",
    "cancelled",
  ];

  const status = String(
    payload.status ?? existing?.status ?? "draft"
  );

  if (!allowedStatuses.includes(status)) {
    throw createServiceError(
      "Invalid shift status.",
      400,
      { field: "status" }
    );
  }

  return {
    startsAt,
    endsAt,
    breakMinutes: Math.round(breakMinutes),
    roleTitle: String(
      payload.roleTitle ?? existing?.roleTitle ?? "Stylist"
    ).trim(),
    location: String(
      payload.location ?? existing?.location ?? "Main salon"
    ).trim(),
    status,
    notes: String(payload.notes ?? existing?.notes ?? "").trim(),
  };
}

async function requireActiveStylist(staffId) {
  const id = objectId(staffId, "staffId");

  const stylist = assertFound(
    await Stylist.findById(id),
    "Stylist not found."
  );

  if (stylist.isActive === false) {
    throw createServiceError(
      "The selected stylist is inactive.",
      409,
      { field: "staffId" }
    );
  }

  return stylist;
}

async function assertNoShiftConflict({
  staffId,
  startsAt,
  endsAt,
  excludeShiftId,
}) {
  const match = {
    staff: staffId,
    status: { $ne: "cancelled" },
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  };

  if (excludeShiftId) {
    match._id = {
      $ne: objectId(excludeShiftId, "shiftId"),
    };
  }

  const [overlappingShift, overlappingTimeOff] = await Promise.all([
    StaffShift.findOne(match).lean(),
    StaffTimeOff.findOne({
      staff: staffId,
      status: "approved",
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    }).lean(),
  ]);

  if (overlappingShift) {
    throw createServiceError(
      "This shift overlaps another shift for the selected stylist.",
      409,
      {
        conflictType: "shift_overlap",
        shift: overlappingShift,
      }
    );
  }

  if (overlappingTimeOff) {
    throw createServiceError(
      "This shift overlaps approved staff time off.",
      409,
      {
        conflictType: "approved_time_off",
        timeOff: overlappingTimeOff,
      }
    );
  }
}

function normaliseShift(shift, attendanceByShift) {
  const shiftId = String(shift._id);
  const attendance = attendanceByShift.get(shiftId) || null;

  return {
    ...shift,
    scheduledMinutes: shiftScheduledMinutes(shift),
    attendance: attendance
      ? {
          ...attendance,
          workedMinutes: attendanceWorkedMinutes(attendance),
        }
      : null,
  };
}

export function calculateRotaMetrics({
  staff = [],
  shifts = [],
  attendance = [],
  appointments = [],
  timeOff = [],
  weekStart,
  overtimeThresholdMinutes = DEFAULT_OVERTIME_MINUTES,
  minimumStaff = 1,
}) {
  const attendanceByShift = new Map(
    attendance.map((item) => [String(item.shift?._id || item.shift), item])
  );

  const activeShifts = shifts.filter(
    (shift) => shift.status !== "cancelled"
  );

  const shiftRows = activeShifts.map((shift) =>
    normaliseShift(shift, attendanceByShift)
  );

  const staffMetrics = new Map();

  for (const stylist of staff) {
    staffMetrics.set(String(stylist._id), {
      staffId: stylist._id,
      name: displayName(stylist),
      scheduledMinutes: 0,
      workedMinutes: 0,
      overtimeMinutes: 0,
      shifts: 0,
      late: 0,
      absent: 0,
    });
  }

  for (const shift of shiftRows) {
    const staffId = String(shift.staff?._id || shift.staff);
    const row = staffMetrics.get(staffId) || {
      staffId: shift.staff?._id || shift.staff,
      name: displayName(shift.staff),
      scheduledMinutes: 0,
      workedMinutes: 0,
      overtimeMinutes: 0,
      shifts: 0,
      late: 0,
      absent: 0,
    };

    row.shifts += 1;
    row.scheduledMinutes += shift.scheduledMinutes;
    row.workedMinutes += Number(shift.attendance?.workedMinutes || 0);

    if (shift.attendance?.status === "late") {
      row.late += 1;
    }

    if (shift.attendance?.status === "absent") {
      row.absent += 1;
    }

    staffMetrics.set(staffId, row);
  }

  for (const row of staffMetrics.values()) {
    row.overtimeMinutes = Math.max(
      row.scheduledMinutes - overtimeThresholdMinutes,
      0
    );
  }

  const alerts = [];

  for (const row of staffMetrics.values()) {
    if (row.overtimeMinutes > 0) {
      alerts.push({
        type: "overtime",
        severity: "warning",
        staffId: row.staffId,
        title: `${row.name} is scheduled for overtime`,
        description: `${row.overtimeMinutes} minutes exceed the weekly threshold.`,
      });
    }
  }

  for (const shift of activeShifts) {
    const shiftStart = new Date(shift.startsAt);
    const shiftEnd = new Date(shift.endsAt);

    const conflict = timeOff.find((record) => {
      const recordStaffId = String(record.staff?._id || record.staff);
      const shiftStaffId = String(shift.staff?._id || shift.staff);

      return (
        record.status === "approved" &&
        recordStaffId === shiftStaffId &&
        intervalOverlaps(
          shiftStart,
          shiftEnd,
          new Date(record.startsAt),
          new Date(record.endsAt)
        )
      );
    });

    if (conflict) {
      alerts.push({
        type: "time_off_conflict",
        severity: "critical",
        staffId: shift.staff?._id || shift.staff,
        shiftId: shift._id,
        title: `${displayName(shift.staff)} has a shift during approved time off`,
        description: "Move or cancel the conflicting shift.",
      });
    }
  }

  for (const appointment of appointments) {
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      continue;
    }

    const { startsAt, endsAt } = appointmentWindow(appointment);

    if (!startsAt || !endsAt) {
      continue;
    }

    const appointmentStaffId = String(
      appointment.stylist?._id || appointment.stylist
    );

    const covered = activeShifts.some((shift) => {
      const shiftStaffId = String(shift.staff?._id || shift.staff);

      return (
        shiftStaffId === appointmentStaffId &&
        new Date(shift.startsAt) <= startsAt &&
        new Date(shift.endsAt) >= endsAt
      );
    });

    if (!covered) {
      alerts.push({
        type: "appointment_outside_shift",
        severity: "critical",
        staffId: appointment.stylist?._id || appointment.stylist,
        appointmentId: appointment._id,
        title: `${displayName(appointment.stylist)} has an appointment outside the rota`,
        description: `${displayName(appointment.customer, "Customer")} is booked at ${startsAt.toLocaleString("en-GB")}.`,
      });
    }
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const dayStart = startOfDay(addDays(weekStart, index));
    const dayEnd = endOfDay(dayStart);

    const dayShifts = activeShifts.filter((shift) =>
      intervalOverlaps(
        new Date(shift.startsAt),
        new Date(shift.endsAt),
        dayStart,
        dayEnd
      )
    );

    const dayAppointments = appointments.filter((appointment) => {
      const { startsAt } = appointmentWindow(appointment);

      return (
        startsAt &&
        startsAt >= dayStart &&
        startsAt <= dayEnd &&
        ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)
      );
    });

    const scheduledStaff = new Set(
      dayShifts.map((shift) => String(shift.staff?._id || shift.staff))
    );

    if (
      dayAppointments.length > 0 &&
      scheduledStaff.size < minimumStaff
    ) {
      alerts.push({
        type: "understaffed_day",
        severity: "warning",
        date: localDateKey(dayStart),
        title: `${dayStart.toLocaleDateString("en-GB", {
          weekday: "long",
        })} is understaffed`,
        description: `${scheduledStaff.size} staff scheduled for ${dayAppointments.length} appointments.`,
      });
    }

    return {
      date: localDateKey(dayStart),
      shifts: dayShifts.length,
      scheduledStaff: scheduledStaff.size,
      appointments: dayAppointments.length,
      scheduledMinutes: dayShifts.reduce(
        (total, shift) => total + shiftScheduledMinutes(shift),
        0
      ),
    };
  });

  const rows = Array.from(staffMetrics.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  return {
    summary: {
      staff: rows.length,
      shifts: shiftRows.length,
      scheduledMinutes: rows.reduce(
        (total, row) => total + row.scheduledMinutes,
        0
      ),
      workedMinutes: rows.reduce(
        (total, row) => total + row.workedMinutes,
        0
      ),
      overtimeMinutes: rows.reduce(
        (total, row) => total + row.overtimeMinutes,
        0
      ),
      lateArrivals: rows.reduce((total, row) => total + row.late, 0),
      absences: rows.reduce((total, row) => total + row.absent, 0),
      alerts: alerts.length,
    },
    staff: rows,
    days,
    alerts,
    shifts: shiftRows,
  };
}

export async function getStaffRota(query = {}) {
  const weekStart = normaliseWeekStart(query.startDate || new Date());
  const weekEnd = addDays(weekStart, 7);

  const requestedEnd = parseOptionalDate(query.endDate, "endDate");

  if (
    requestedEnd &&
    (requestedEnd.getTime() - weekStart.getTime()) / 86_400_000 >
      MAX_WEEK_RANGE_DAYS
  ) {
    throw createServiceError(
      `Rota queries cannot exceed ${MAX_WEEK_RANGE_DAYS} days.`,
      400
    );
  }

  const overtimeThresholdMinutes = Math.max(
    Number(query.overtimeThresholdMinutes || DEFAULT_OVERTIME_MINUTES),
    60
  );

  const minimumStaff = Math.min(
    Math.max(Number(query.minimumStaff || 1), 1),
    20
  );

  const [staff, shifts, appointments, timeOff] = await Promise.all([
    Stylist.find({ isActive: { $ne: false } })
      .select("firstName lastName email isActive workingHours")
      .sort({ firstName: 1, lastName: 1 })
      .lean(),

    StaffShift.find({
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
      appointmentDate: {
        $gte: weekStart,
        $lt: weekEnd,
      },
      status: { $nin: ["cancelled", "no_show"] },
    })
      .populate("stylist", "firstName lastName email")
      .populate("customer", "firstName lastName fullName name")
      .populate("service", "name duration")
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .lean(),

    StaffTimeOff.find({
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
    ? await StaffAttendance.find({ shift: { $in: shiftIds } })
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

export async function createStaffShift(payload = {}, actor) {
  const stylist = await requireActiveStylist(payload.staffId || payload.staff);
  const values = validateShiftPayload(payload);

  await assertNoShiftConflict({
    staffId: stylist._id,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
  });

  const actorId = userId(actor);

  const shift = await StaffShift.create({
    staff: stylist._id,
    ...values,
    createdBy: actorId,
    updatedBy: actorId,
    publishedAt: values.status === "published" ? new Date() : null,
    publishedBy: values.status === "published" ? actorId : null,
  });

  await StaffAttendance.findOneAndUpdate(
    { shift: shift._id },
    {
      $setOnInsert: {
        shift: shift._id,
        staff: stylist._id,
        status: "scheduled",
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return shift.populate("staff", "firstName lastName email isActive");
}

export async function updateStaffShift(shiftId, payload = {}, actor) {
  const shift = assertFound(
    await StaffShift.findById(objectId(shiftId, "shiftId")),
    "Staff shift not found."
  );

  const attendance = await StaffAttendance.findOne({ shift: shift._id });

  if (
    attendance?.clockInAt &&
    (payload.startsAt !== undefined ||
      payload.endsAt !== undefined ||
      payload.staffId !== undefined ||
      payload.staff !== undefined)
  ) {
    throw createServiceError(
      "A shift cannot be moved after attendance has been recorded.",
      409
    );
  }

  const stylist = await requireActiveStylist(
    payload.staffId || payload.staff || shift.staff
  );

  const values = validateShiftPayload(payload, shift);

  await assertNoShiftConflict({
    staffId: stylist._id,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
    excludeShiftId: shift._id,
  });

  shift.staff = stylist._id;
  shift.startsAt = values.startsAt;
  shift.endsAt = values.endsAt;
  shift.breakMinutes = values.breakMinutes;
  shift.roleTitle = values.roleTitle;
  shift.location = values.location;
  shift.status = values.status;
  shift.notes = values.notes;
  shift.updatedBy = userId(actor);

  if (values.status === "published" && !shift.publishedAt) {
    shift.publishedAt = new Date();
    shift.publishedBy = userId(actor);
  }

  await shift.save();

  if (attendance) {
    attendance.staff = stylist._id;
    attendance.updatedBy = userId(actor);
    await attendance.save();
  }

  return shift.populate("staff", "firstName lastName email isActive");
}

export async function deleteStaffShift(shiftId) {
  const shift = assertFound(
    await StaffShift.findById(objectId(shiftId, "shiftId")),
    "Staff shift not found."
  );

  const attendance = await StaffAttendance.findOne({ shift: shift._id }).lean();

  if (attendance?.clockInAt) {
    throw createServiceError(
      "A shift with recorded attendance cannot be deleted.",
      409
    );
  }

  if (!["draft", "cancelled"].includes(shift.status)) {
    throw createServiceError(
      "Only draft or cancelled shifts can be deleted.",
      409
    );
  }

  await Promise.all([
    StaffAttendance.deleteOne({ shift: shift._id }),
    StaffShift.deleteOne({ _id: shift._id }),
  ]);

  return {
    deleted: true,
    shiftId: shift._id,
  };
}

export async function publishStaffRotaWeek(startDate, actor) {
  const weekStart = normaliseWeekStart(startDate || new Date());
  const weekEnd = addDays(weekStart, 7);
  const actorId = userId(actor);
  const publishedAt = new Date();

  const result = await StaffShift.updateMany(
    {
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

async function requireShiftWithAttendance(shiftId) {
  const shift = assertFound(
    await StaffShift.findById(objectId(shiftId, "shiftId")),
    "Staff shift not found."
  );

  let attendance = await StaffAttendance.findOne({ shift: shift._id });

  if (!attendance) {
    attendance = await StaffAttendance.create({
      shift: shift._id,
      staff: shift.staff,
      status: "scheduled",
    });
  }

  return { shift, attendance };
}

export async function clockInStaffShift(shiftId, payload = {}, actor) {
  const { shift, attendance } = await requireShiftWithAttendance(shiftId);

  if (shift.status === "cancelled") {
    throw createServiceError("Cancelled shifts cannot be clocked in.", 409);
  }

  if (attendance.clockInAt) {
    throw createServiceError("Attendance has already been clocked in.", 409);
  }

  const clockInAt = parseOptionalDate(payload.at, "at") || new Date();
  const graceMinutes = Math.max(Number(payload.graceMinutes || 10), 0);
  const lateThreshold = new Date(
    new Date(shift.startsAt).getTime() + graceMinutes * 60_000
  );

  attendance.clockInAt = clockInAt;
  attendance.clockOutAt = null;
  attendance.status = clockInAt > lateThreshold ? "late" : "present";
  attendance.notes = String(payload.notes || attendance.notes || "").trim();
  attendance.updatedBy = userId(actor);

  await attendance.save();

  return attendance.populate("staff", "firstName lastName email");
}

export async function clockOutStaffShift(shiftId, payload = {}, actor) {
  const { shift, attendance } = await requireShiftWithAttendance(shiftId);

  if (!attendance.clockInAt) {
    throw createServiceError("Clock in must be recorded first.", 409);
  }

  if (attendance.clockOutAt) {
    throw createServiceError("Attendance has already been clocked out.", 409);
  }

  const clockOutAt = parseOptionalDate(payload.at, "at") || new Date();

  if (clockOutAt <= new Date(attendance.clockInAt)) {
    throw createServiceError(
      "Clock-out time must be after clock-in time.",
      400
    );
  }

  attendance.clockOutAt = clockOutAt;
  attendance.status = "completed";
  attendance.notes = String(payload.notes || attendance.notes || "").trim();
  attendance.updatedBy = userId(actor);

  shift.status = "completed";
  shift.updatedBy = userId(actor);

  await Promise.all([attendance.save(), shift.save()]);

  return attendance.populate("staff", "firstName lastName email");
}

export async function updateStaffAttendance(shiftId, payload = {}, actor) {
  const { shift, attendance } = await requireShiftWithAttendance(shiftId);
  const allowedStatuses = [
    "scheduled",
    "present",
    "late",
    "absent",
    "completed",
  ];

  const status = String(payload.status || attendance.status);

  if (!allowedStatuses.includes(status)) {
    throw createServiceError("Invalid attendance status.", 400);
  }

  attendance.status = status;
  attendance.notes = String(payload.notes ?? attendance.notes ?? "").trim();
  attendance.updatedBy = userId(actor);

  if (status === "absent") {
    attendance.clockInAt = null;
    attendance.clockOutAt = null;
  } else {
    const clockInAt = parseOptionalDate(payload.clockInAt, "clockInAt");
    const clockOutAt = parseOptionalDate(payload.clockOutAt, "clockOutAt");

    if (clockInAt !== null) {
      attendance.clockInAt = clockInAt;
    }

    if (clockOutAt !== null) {
      attendance.clockOutAt = clockOutAt;
    }
  }

  if (
    attendance.clockInAt &&
    attendance.clockOutAt &&
    new Date(attendance.clockOutAt) <= new Date(attendance.clockInAt)
  ) {
    throw createServiceError(
      "Clock-out time must be after clock-in time.",
      400
    );
  }

  if (status === "completed") {
    shift.status = "completed";
    shift.updatedBy = userId(actor);
  }

  await Promise.all([attendance.save(), shift.save()]);

  return attendance.populate("staff", "firstName lastName email");
}

export default {
  calculateRotaMetrics,
  clockInStaffShift,
  clockOutStaffShift,
  createStaffShift,
  deleteStaffShift,
  getStaffRota,
  normaliseWeekStart,
  publishStaffRotaWeek,
  shiftScheduledMinutes,
  attendanceWorkedMinutes,
  updateStaffAttendance,
  updateStaffShift,
};
