import Appointment from "../../models/Appointment.js";

import {
  addUtcMonths,
  clampInteger,
  getAppointmentDate,
  getAppointmentDuration,
  getEntityId,
  getEntityName,
  normaliseStatus,
  roundNumber,
  startOfUtcMonth,
} from "../shared/analyticsUtils.js";

const CAPACITY_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "no_show",
]);

function createStaffRecord(stylist) {
  return {
    stylistId: getEntityId(stylist) || "unassigned",
    name: getEntityName(stylist, "Unassigned stylist"),
    appointmentCount: 0,
    completedAppointments: 0,
    bookedMinutes: 0,
    weekdays: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      appointmentCount: 0,
      bookedMinutes: 0,
    })),
  };
}

async function generateCapacityPlan({ months = 3, weeklyHoursPerStaff = 40 } = {}) {
  const selectedMonths = clampInteger(months, 1, 12, 3);
  const selectedWeeklyHours = clampInteger(weeklyHoursPerStaff, 1, 80, 40);
  const now = new Date();
  const currentMonth = startOfUtcMonth(now);
  const startDate = addUtcMonths(currentMonth, -(selectedMonths - 1));
  const endDate = addUtcMonths(currentMonth, 1);

  const appointments = await Appointment.find({
    $or: [
      { startsAt: { $gte: startDate, $lt: endDate } },
      { appointmentDate: { $gte: startDate, $lt: endDate } },
    ],
  })
    .populate("stylist", "firstName lastName name fullName displayName email role")
    .populate("service", "name duration")
    .lean();

  const staffMap = new Map();

  for (const appointment of appointments) {
    const date = getAppointmentDate(appointment);
    const status = normaliseStatus(appointment.status);
    if (!date || !CAPACITY_STATUSES.has(status)) continue;

    const stylistId = getEntityId(appointment.stylist) || "unassigned";
    if (!staffMap.has(stylistId)) {
      staffMap.set(stylistId, createStaffRecord(appointment.stylist));
    }

    const record = staffMap.get(stylistId);
    const duration = getAppointmentDuration(appointment);
    const weekday = date.getDay();
    record.appointmentCount += 1;
    record.bookedMinutes += duration;
    if (status === "completed") record.completedAppointments += 1;
    record.weekdays[weekday].appointmentCount += 1;
    record.weekdays[weekday].bookedMinutes += duration;
  }

  const weeks = Math.max(1, (endDate.getTime() - startDate.getTime()) / 604_800_000);
  const availableHoursPerStaff = weeks * selectedWeeklyHours;

  const staff = Array.from(staffMap.values())
    .map((record) => {
      const bookedHours = record.bookedMinutes / 60;
      const utilisationRate =
        availableHoursPerStaff > 0 ? (bookedHours / availableHoursPerStaff) * 100 : 0;

      return {
        stylistId: record.stylistId,
        name: record.name,
        appointmentCount: record.appointmentCount,
        completedAppointments: record.completedAppointments,
        bookedHours: roundNumber(bookedHours, 1),
        availableHours: roundNumber(availableHoursPerStaff, 1),
        spareHours: roundNumber(Math.max(0, availableHoursPerStaff - bookedHours), 1),
        utilisationRate: roundNumber(utilisationRate, 1),
        status:
          utilisationRate >= 90
            ? "overloaded"
            : utilisationRate >= 65
              ? "balanced"
              : "underused",
        weekdays: record.weekdays.map((weekday) => ({
          ...weekday,
          bookedHours: roundNumber(weekday.bookedMinutes / 60, 1),
        })),
      };
    })
    .sort((a, b) => b.utilisationRate - a.utilisationRate);

  const totalBookedHours = staff.reduce((total, item) => total + item.bookedHours, 0);
  const totalAvailableHours = staff.length * availableHoursPerStaff;

  return {
    generatedAt: now.toISOString(),
    period: {
      months: selectedMonths,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      weeklyHoursPerStaff: selectedWeeklyHours,
    },
    summary: {
      staffCount: staff.length,
      totalBookedHours: roundNumber(totalBookedHours, 1),
      totalAvailableHours: roundNumber(totalAvailableHours, 1),
      spareHours: roundNumber(Math.max(0, totalAvailableHours - totalBookedHours), 1),
      utilisationRate:
        totalAvailableHours > 0
          ? roundNumber((totalBookedHours / totalAvailableHours) * 100, 1)
          : 0,
      overloadedStaff: staff.filter((item) => item.status === "overloaded").length,
      underusedStaff: staff.filter((item) => item.status === "underused").length,
    },
    staff,
  };
}

export { generateCapacityPlan };
