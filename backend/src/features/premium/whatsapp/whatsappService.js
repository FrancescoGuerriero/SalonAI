const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function createServiceError(message, statusCode = 400, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.details = details;
  return error;
}

export function normaliseWhatsAppPhone(value) {
  let phone = String(value || "")
    .trim()
    .replace(/^whatsapp:/i, "")
    .replace(/[\s()-]/g, "");

  if (phone.startsWith("00")) {
    phone = `+${phone.slice(2)}`;
  }

  if (!PHONE_PATTERN.test(phone)) {
    throw createServiceError(
      "A valid WhatsApp phone number in international format is required.",
      400,
      { field: "phone" }
    );
  }

  return phone;
}

export function normaliseIncomingWhatsApp(body = {}) {
  const phone = normaliseWhatsAppPhone(body.From || body.phone);
  const message = String(body.Body ?? body.body ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const providerMessageId = String(
    body.MessageSid || body.SmsMessageSid || body.providerMessageId || ""
  ).trim();
  const displayName = String(body.ProfileName || body.displayName || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);

  if (!message) {
    throw createServiceError(
      "The incoming WhatsApp message is empty.",
      400,
      { field: "body" }
    );
  }

  if (message.length > 4096) {
    throw createServiceError(
      "WhatsApp messages cannot exceed 4096 characters.",
      400,
      { field: "body" }
    );
  }

  return {
    phone,
    message,
    providerMessageId,
    displayName,
  };
}

export function validateBookingSessionInput(payload = {}) {
  const serviceId = String(payload.serviceId || payload.service || "").trim();
  const stylistId = String(payload.stylistId || payload.stylist || "").trim();
  const appointmentDate = String(payload.appointmentDate || payload.date || "").trim();
  const appointmentTime = String(payload.appointmentTime || payload.time || "").trim();

  if (!serviceId || !stylistId || !appointmentDate || !appointmentTime) {
    throw createServiceError(
      "Service, stylist, appointment date and appointment time are required.",
      400
    );
  }

  if (!DATE_PATTERN.test(appointmentDate)) {
    throw createServiceError(
      "Appointment date must use YYYY-MM-DD format.",
      400,
      { field: "appointmentDate" }
    );
  }

  if (!TIME_PATTERN.test(appointmentTime)) {
    throw createServiceError(
      "Appointment time must use HH:mm format.",
      400,
      { field: "appointmentTime" }
    );
  }

  return {
    serviceId,
    stylistId,
    appointmentDate,
    appointmentTime,
  };
}

export function splitCustomerName(value) {
  const parts = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);

  if (!parts.length) {
    return {
      firstName: "WhatsApp",
      lastName: "Customer",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "Customer",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function buildBookingConfirmationMessage({
  serviceName,
  stylistName,
  appointmentDate,
  appointmentTime,
} = {}) {
  const date = new Date(appointmentDate);
  const dateLabel = Number.isNaN(date.getTime())
    ? String(appointmentDate || "")
    : new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);

  return [
    "Your SalonAI appointment is confirmed.",
    serviceName ? `Service: ${serviceName}.` : "",
    stylistName ? `Stylist: ${stylistName}.` : "",
    dateLabel ? `Date: ${dateLabel}.` : "",
    appointmentTime ? `Time: ${appointmentTime}.` : "",
    "Use your SalonAI account or contact the salon team if you need help.",
  ]
    .filter(Boolean)
    .join(" ");
}

export {
  DATE_PATTERN,
  PHONE_PATTERN,
  TIME_PATTERN,
};

export default {
  buildBookingConfirmationMessage,
  normaliseIncomingWhatsApp,
  normaliseWhatsAppPhone,
  splitCustomerName,
  validateBookingSessionInput,
};
