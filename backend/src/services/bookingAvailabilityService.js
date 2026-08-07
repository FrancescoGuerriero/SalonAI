const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function createValidationError(message, field) {
  const error = new Error(message);
  error.statusCode = 400;
  error.status = 400;
  error.details = { field };

  return error;
}

function timeToMinutes(value, field = "time") {
  const time = String(value || "").trim();

  if (!TIME_PATTERN.test(time)) {
    throw createValidationError(
      `${field} must use HH:mm format.`,
      field
    );
  }

  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseBookingDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(value || "").trim()
  );

  if (!match) {
    throw createValidationError(
      "date must use YYYY-MM-DD format.",
      "date"
    );
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw createValidationError(
      "date must be a valid calendar date.",
      "date"
    );
  }

  return date;
}

function dateAtMinutes(date, minutes) {
  const value = new Date(date);

  value.setHours(
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0
  );

  return value;
}

function appointmentInterval(appointment) {
  const start = appointment?.startsAt
    ? new Date(appointment.startsAt)
    : new Date(appointment?.appointmentDate);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  if (!appointment?.startsAt && appointment?.appointmentTime) {
    const startMinutes = timeToMinutes(
      appointment.appointmentTime,
      "appointmentTime"
    );

    start.setHours(
      Math.floor(startMinutes / 60),
      startMinutes % 60,
      0,
      0
    );
  }

  const suppliedEnd = appointment?.endsAt
    ? new Date(appointment.endsAt)
    : null;

  const end = suppliedEnd && !Number.isNaN(suppliedEnd.getTime())
    ? suppliedEnd
    : new Date(
        start.getTime() +
          Math.max(1, Number(appointment?.duration) || 60) * 60000
      );

  return { start, end };
}

function timeOffInterval(entry) {
  const start = new Date(entry?.startsAt);
  const end = new Date(entry?.endsAt);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }

  return { start, end };
}

function overlaps(left, right) {
  return left.start < right.end && left.end > right.start;
}

export function buildAvailableSlots({
  date,
  ranges = [],
  appointments = [],
  timeOff = [],
  duration,
  interval = 30,
  now = new Date(),
}) {
  const targetDate = date instanceof Date
    ? new Date(date)
    : parseBookingDate(date);

  if (Number.isNaN(targetDate.getTime())) {
    throw createValidationError(
      "date must be a valid calendar date.",
      "date"
    );
  }

  const serviceDuration = Number(duration);
  const slotInterval = Number(interval);

  if (
    !Number.isInteger(serviceDuration) ||
    serviceDuration < 1 ||
    serviceDuration > 1440
  ) {
    throw createValidationError(
      "duration must be between 1 and 1440 minutes.",
      "duration"
    );
  }

  if (
    !Number.isInteger(slotInterval) ||
    slotInterval < 5 ||
    slotInterval > 120
  ) {
    throw createValidationError(
      "interval must be between 5 and 120 minutes.",
      "interval"
    );
  }

  const blockedIntervals = [
    ...appointments
      .filter(
        (appointment) =>
          !["cancelled", "no_show"].includes(appointment?.status)
      )
      .map(appointmentInterval),
    ...timeOff.map(timeOffInterval),
  ].filter(Boolean);

  const slots = [];

  for (const range of ranges) {
    const rangeStart = timeToMinutes(range?.start, "range.start");
    const rangeEnd = timeToMinutes(range?.end, "range.end");

    if (rangeEnd <= rangeStart) {
      continue;
    }

    for (
      let startMinutes = rangeStart;
      startMinutes + serviceDuration <= rangeEnd;
      startMinutes += slotInterval
    ) {
      const candidate = {
        start: dateAtMinutes(targetDate, startMinutes),
        end: dateAtMinutes(
          targetDate,
          startMinutes + serviceDuration
        ),
      };

      if (candidate.start <= now) {
        continue;
      }

      if (blockedIntervals.some((blocked) => overlaps(candidate, blocked))) {
        continue;
      }

      slots.push(minutesToTime(startMinutes));
    }
  }

  return [...new Set(slots)].sort();
}

export function stylistOffersService(stylist, serviceId) {
  if (!serviceId) {
    return true;
  }

  if (!Array.isArray(stylist?.services) || stylist.services.length === 0) {
    return true;
  }

  const requestedId = String(serviceId);

  return stylist.services.some((service) => {
    const offeredId = service?._id || service;

    return String(offeredId) === requestedId;
  });
}

export default {
  buildAvailableSlots,
  parseBookingDate,
  stylistOffersService,
};
