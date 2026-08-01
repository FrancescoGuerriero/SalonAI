import Appointment from "../../models/Appointment.js";

import {
  addDays,
  clampInteger,
  getAppointmentDate,
  getAppointmentDuration,
  getEntityId,
  getEntityName,
  normaliseStatus,
  roundNumber,
} from "../shared/analyticsUtils.js";

const ACTIVE_STATUSES = ["pending", "confirmed", "checked_in", "in_progress"];
const OPENING_HOUR = 9;
const CLOSING_HOUR = 19;
const SLOT_MINUTES = 30;

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function setTime(date, hour, minute = 0) {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function overlaps(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function getHistoricalPreferences(appointments) {
  const weekdayCounts = new Map();
  const hourCounts = new Map();
  const stylistCounts = new Map();

  for (const appointment of appointments) {
    const date = getAppointmentDate(appointment);
    if (!date || normaliseStatus(appointment.status) !== "completed") continue;

    const weekday = date.getDay();
    const hour = date.getHours();
    const stylistId = getEntityId(appointment.stylist);

    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) || 0) + 1);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    if (stylistId) stylistCounts.set(stylistId, (stylistCounts.get(stylistId) || 0) + 1);
  }

  return { weekdayCounts, hourCounts, stylistCounts };
}

function scoreCandidate({ candidate, preferences, loadByStylist }) {
  const weekdayPreference = preferences.weekdayCounts.get(candidate.start.getDay()) || 0;
  const hourPreference = preferences.hourCounts.get(candidate.start.getHours()) || 0;
  const stylistPreference = preferences.stylistCounts.get(candidate.stylistId) || 0;
  const stylistLoad = loadByStylist.get(candidate.stylistId) || 0;
  const leadDays = Math.max(
    0,
    Math.round((candidate.start.getTime() - Date.now()) / 86_400_000)
  );

  return roundNumber(
    100 +
      weekdayPreference * 15 +
      hourPreference * 10 +
      stylistPreference * 20 -
      stylistLoad * 2 -
      leadDays * 0.25,
    1
  );
}

async function recommendAppointmentSlots({
  customerId,
  serviceId,
  days = 21,
  limit = 20,
  duration,
} = {}) {
  const selectedDays = clampInteger(days, 1, 90, 21);
  const selectedLimit = clampInteger(limit, 1, 100, 20);
  const now = new Date();
  const rangeStart = startOfDay(now);
  const rangeEnd = addDays(rangeStart, selectedDays + 1);

  const [upcomingAppointments, history] = await Promise.all([
    Appointment.find({
      status: { $in: ACTIVE_STATUSES },
      $or: [
        { startsAt: { $gte: rangeStart, $lt: rangeEnd } },
        { appointmentDate: { $gte: rangeStart, $lt: rangeEnd } },
      ],
    })
      .populate("stylist", "firstName lastName name fullName displayName email")
      .populate("service", "name duration price")
      .lean(),
    Appointment.find({
      ...(customerId ? { customer: customerId } : {}),
      ...(serviceId ? { service: serviceId } : {}),
      status: "completed",
    })
      .populate("stylist", "firstName lastName name fullName displayName email")
      .populate("service", "name duration price")
      .sort({ startsAt: -1, appointmentDate: -1 })
      .limit(200)
      .lean(),
  ]);

  const preferences = getHistoricalPreferences(history);
  const stylistMap = new Map();

  for (const appointment of [...history, ...upcomingAppointments]) {
    const stylistId = getEntityId(appointment.stylist);
    if (!stylistId) continue;
    stylistMap.set(stylistId, {
      stylistId,
      name: getEntityName(appointment.stylist, "Salon stylist"),
    });
  }

  if (stylistMap.size === 0) {
    stylistMap.set("unassigned", {
      stylistId: "unassigned",
      name: "Any available stylist",
    });
  }

  const inferredDuration =
    clampInteger(duration, 15, 480, 0) ||
    history.map((item) => getAppointmentDuration(item, 0)).find((value) => value > 0) ||
    60;

  const bookingsByStylist = new Map();
  const loadByStylist = new Map();

  for (const appointment of upcomingAppointments) {
    const stylistId = getEntityId(appointment.stylist) || "unassigned";
    const start = getAppointmentDate(appointment);
    if (!start) continue;
    const end = new Date(start.getTime() + getAppointmentDuration(appointment) * 60_000);
    const list = bookingsByStylist.get(stylistId) || [];
    list.push({ start, end });
    bookingsByStylist.set(stylistId, list);
    loadByStylist.set(stylistId, (loadByStylist.get(stylistId) || 0) + 1);
  }

  const candidates = [];

  for (let dayOffset = 0; dayOffset <= selectedDays; dayOffset += 1) {
    const day = addDays(rangeStart, dayOffset);
    const weekday = day.getDay();

    if (weekday === 0 || day < now) continue;

    for (const stylist of stylistMap.values()) {
      const bookings = bookingsByStylist.get(stylist.stylistId) || [];

      for (
        let minutes = OPENING_HOUR * 60;
        minutes + inferredDuration <= CLOSING_HOUR * 60;
        minutes += SLOT_MINUTES
      ) {
        const start = setTime(day, Math.floor(minutes / 60), minutes % 60);
        const end = new Date(start.getTime() + inferredDuration * 60_000);

        if (start <= now) continue;
        if (bookings.some((booking) => overlaps(start, end, booking.start, booking.end))) {
          continue;
        }

        const candidate = {
          stylistId: stylist.stylistId,
          stylistName: stylist.name,
          start,
          end,
          duration: inferredDuration,
        };

        candidates.push({
          ...candidate,
          score: scoreCandidate({ candidate, preferences, loadByStylist }),
        });
      }
    }
  }

  const recommendations = candidates
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, selectedLimit)
    .map((candidate, index) => ({
      rank: index + 1,
      stylistId: candidate.stylistId,
      stylistName: candidate.stylistName,
      startsAt: candidate.start.toISOString(),
      endsAt: candidate.end.toISOString(),
      duration: candidate.duration,
      score: candidate.score,
      reasons: [
        preferences.stylistCounts.has(candidate.stylistId)
          ? "Matches previous stylist preference"
          : "Balances stylist workload",
        preferences.weekdayCounts.has(candidate.start.getDay())
          ? "Matches previous weekday behaviour"
          : "Available within the selected period",
      ],
    }));

  return {
    generatedAt: now.toISOString(),
    parameters: {
      customerId: customerId || null,
      serviceId: serviceId || null,
      days: selectedDays,
      duration: inferredDuration,
    },
    summary: {
      recommendationCount: recommendations.length,
      stylistCount: stylistMap.size,
      checkedUpcomingBookings: upcomingAppointments.length,
      historicalAppointments: history.length,
      bestRecommendation: recommendations[0] || null,
    },
    recommendations,
  };
}

export { recommendAppointmentSlots };
