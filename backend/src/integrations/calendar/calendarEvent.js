import {
  getSalonTimeZone,
} from "../../shared/salonTime.js";

const TERMINAL_CANCELLED_STATUSES =
  new Set(["cancelled"]);

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value) {
  if (
    value &&
    typeof value === "object" &&
    value._id
  ) {
    return text(value._id);
  }

  return text(value);
}

function displayName(value) {
  if (!value || typeof value !== "object") {
    return "";
  }

  return (
    text(value.fullName) ||
    text(value.name) ||
    [value.firstName, value.lastName]
      .map(text)
      .filter(Boolean)
      .join(" ")
  );
}

function validInstant(value, field) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const error = new Error(
      `Calendar event requires a valid ${field}.`
    );
    error.code = "INVALID_CALENDAR_EVENT_TIME";
    error.field = field;
    throw error;
  }

  return date;
}

export function buildAppointmentCalendarEvent({
  appointment,
  includeCustomerName = false,
  salonName = "SalonAI",
  timeZone = getSalonTimeZone(),
} = {}) {
  if (!appointment || typeof appointment !== "object") {
    throw new TypeError(
      "An appointment is required to build a calendar event."
    );
  }

  const appointmentId = objectId(appointment._id);

  if (!appointmentId) {
    const error = new Error(
      "Calendar event requires an appointment identifier."
    );
    error.code = "MISSING_APPOINTMENT_ID";
    throw error;
  }

  const startsAt = validInstant(
    appointment.startsAt,
    "startsAt"
  );
  const endsAt = validInstant(
    appointment.endsAt,
    "endsAt"
  );

  if (endsAt <= startsAt) {
    const error = new Error(
      "Calendar event end must be after its start."
    );
    error.code = "INVALID_CALENDAR_EVENT_WINDOW";
    throw error;
  }

  const serviceName =
    displayName(appointment.service) ||
    text(appointment.serviceName) ||
    "Salon appointment";

  const customerName =
    displayName(appointment.customer);

  const stylistName =
    displayName(appointment.stylist);

  const summaryParts = [
    text(salonName) || "SalonAI",
    serviceName,
  ];

  if (includeCustomerName && customerName) {
    summaryParts.push(customerName);
  }

  return Object.freeze({
    sourceType: "appointment",
    sourceId: appointmentId,
    summary: summaryParts.join(" — "),
    start: startsAt.toISOString(),
    end: endsAt.toISOString(),
    timeZone,
    visibility: "private",
    status: TERMINAL_CANCELLED_STATUSES.has(
      text(appointment.status)
    )
      ? "cancelled"
      : "confirmed",
    staff: stylistName,
    metadata: Object.freeze({
      appointmentId,
      stylistId: objectId(appointment.stylist),
      serviceId: objectId(appointment.service),
      bookingSource: text(
        appointment.bookingSource
      ),
    }),
  });
}
