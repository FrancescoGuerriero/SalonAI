import Appointment from "../../models/Appointment.js";
import { sendTransactionalNotification } from "../../services/transactionalNotificationService.js";
import { resolveWhatsAppEventTemplate } from "../../providers/whatsapp/whatsappTemplateResolver.js";

function text(value) {
  return String(value ?? "").trim();
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function customerName(customer) {
  return (
    text(customer?.preferredName) ||
    [customer?.firstName, customer?.lastName]
      .map(text)
      .filter(Boolean)
      .join(" ") ||
    text(customer?.fullName) ||
    text(customer?.name) ||
    "Customer"
  );
}

function stylistName(stylist) {
  return (
    [stylist?.firstName, stylist?.lastName]
      .map(text)
      .filter(Boolean)
      .join(" ") ||
    text(stylist?.name) ||
    "your stylist"
  );
}

function appointmentStart(appointment) {
  if (appointment?.startsAt) {
    const start = new Date(appointment.startsAt);
    if (!Number.isNaN(start.getTime())) return start;
  }

  const date = new Date(appointment?.appointmentDate);
  if (Number.isNaN(date.getTime())) return null;

  const [hours = "0", minutes = "0"] = text(
    appointment?.appointmentTime || "00:00"
  ).split(":");

  date.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return date;
}

function formatAppointmentDate(start) {
  if (!start) return "your scheduled date";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: process.env.SALON_TIME_ZONE || "Europe/London",
  }).format(start);
}

function formatAppointmentTime(start, fallback = "") {
  if (!start) return text(fallback) || "your scheduled time";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: process.env.SALON_TIME_ZONE || "Europe/London",
  }).format(start);
}

function reminderChannel(customer) {
  const reminder = text(
    customer?.bookingPreferences?.preferredReminderChannel
  ).toLowerCase();

  if (["email", "sms", "whatsapp", "none"].includes(reminder)) {
    return reminder;
  }

  return text(customer?.communicationPreferences?.preferredChannel).toLowerCase() || "email";
}

function notificationChannels(customer, { reminder = false } = {}) {
  const preferences = customer?.communicationPreferences || {};
  if (preferences.unsubscribed === true) return [];

  const channels = [];
  const email = text(customer?.email);
  const phone = text(
    customer?.phone ||
      customer?.alternativePhone ||
      customer?.phoneNumber ||
      customer?.mobile
  );

  if (email && preferences.emailUnsubscribed !== true) {
    channels.push("email");
  }

  const preferred = reminder
    ? reminderChannel(customer)
    : text(preferences.preferredChannel).toLowerCase();

  if (preferred === "none") return channels;

  if (
    preferred === "sms" &&
    phone &&
    preferences.smsUnsubscribed !== true
  ) {
    channels.push("sms");
  }

  if (preferred === "whatsapp" && phone) {
    channels.push("whatsapp");
  }

  return [...new Set(channels)];
}

async function loadAppointment(appointmentId) {
  return Appointment.findById(appointmentId)
    .populate(
      "customer",
      "firstName lastName fullName preferredName name email phone alternativePhone phoneNumber mobile communicationPreferences bookingPreferences"
    )
    .populate("service", "name category price duration")
    .populate("stylist", "name firstName lastName email phone")
    .lean();
}

function recipient(customer) {
  return {
    name: customerName(customer),
    email: text(customer?.email),
    phone: text(
      customer?.phone ||
        customer?.alternativePhone ||
        customer?.phoneNumber ||
        customer?.mobile
    ),
  };
}

function appointmentDetails(appointment) {
  const start = appointmentStart(appointment);
  return {
    name: customerName(appointment.customer),
    service: text(appointment.service?.name) || "your salon service",
    stylist: stylistName(appointment.stylist),
    date: formatAppointmentDate(start),
    time: formatAppointmentTime(start, appointment.appointmentTime),
    start,
  };
}

function baseMetadata(appointment) {
  return {
    appointmentId: String(appointment._id),
    customerId: appointment.customer?._id
      ? String(appointment.customer._id)
      : null,
    serviceId: appointment.service?._id
      ? String(appointment.service._id)
      : null,
    stylistId: appointment.stylist?._id
      ? String(appointment.stylist._id)
      : null,
    appointmentStartsAt: appointmentStart(appointment)?.toISOString() || null,
    appointmentStatus: appointment.status,
    paymentStatus: appointment.paymentStatus,
  };
}

async function sendAppointmentEvent({
  appointment,
  event,
  eventKey,
  subject,
  body,
  html,
  templateKey,
  templateVariables,
  reminder = false,
  metadata = {},
  actorId = null,
}) {
  const channels = notificationChannels(appointment.customer, { reminder });

  if (channels.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "no_enabled_channels",
      event,
      eventKey,
    };
  }

  const whatsappTemplate =
    resolveWhatsAppEventTemplate(
      templateKey
    );

  return sendTransactionalNotification({
    event,
    eventKey,
    channels,
    recipient: recipient(appointment.customer),
    subject,
    text: body,
    html,
    whatsapp: {
      body,
      template: whatsappTemplate,
      contentVariables: templateVariables,
    },
    customerId: appointment.customer?._id || null,
    actorId,
    metadata: {
      ...baseMetadata(appointment),
      ...metadata,
    },
  });
}

export async function notifyAppointmentConfirmed(
  appointmentId,
  { eventKeySuffix = "", actorId = null } = {}
) {
  const appointment = await loadAppointment(appointmentId);
  if (!appointment) return { success: false, skipped: true, reason: "appointment_not_found" };

  const details = appointmentDetails(appointment);
  const body = `Hi ${details.name}, your ${details.service} appointment with ${details.stylist} is confirmed for ${details.date} at ${details.time}.`;

  return sendAppointmentEvent({
    appointment,
    event: "appointment.confirmed",
    eventKey: `appointment.confirmed:${appointment._id}:${eventKeySuffix || appointment.updatedAt || appointment.createdAt}`,
    subject: `Appointment confirmed - ${details.date} ${details.time}`,
    body,
    html: `<p>Hi ${details.name},</p><p>Your <strong>${details.service}</strong> appointment with <strong>${details.stylist}</strong> is confirmed for <strong>${details.date} at ${details.time}</strong>.</p>`,
    templateKey: "appointment_confirmed",
    templateVariables: {
      1: details.name,
      2: details.service,
      3: details.stylist,
      4: details.date,
      5: details.time,
    },
    actorId,
  });
}

export async function notifyAppointmentRescheduled(
  appointmentId,
  { eventKeySuffix = "", actorId = null } = {}
) {
  const appointment = await loadAppointment(appointmentId);
  if (!appointment) return { success: false, skipped: true, reason: "appointment_not_found" };

  const details = appointmentDetails(appointment);
  const latestReschedule = Array.isArray(appointment.rescheduleHistory)
    ? appointment.rescheduleHistory.at(-1)
    : null;
  const version = eventKeySuffix || latestReschedule?.changedAt || appointment.rescheduledAt || appointment.updatedAt;
  const body = `Hi ${details.name}, your ${details.service} appointment has been rescheduled to ${details.date} at ${details.time} with ${details.stylist}.`;

  return sendAppointmentEvent({
    appointment,
    event: "appointment.rescheduled",
    eventKey: `appointment.rescheduled:${appointment._id}:${version}`,
    subject: `Appointment rescheduled - ${details.date} ${details.time}`,
    body,
    html: `<p>Hi ${details.name},</p><p>Your <strong>${details.service}</strong> appointment has been rescheduled to <strong>${details.date} at ${details.time}</strong> with <strong>${details.stylist}</strong>.</p>`,
    templateKey: "appointment_rescheduled",
    templateVariables: {
      1: details.name,
      2: details.service,
      3: details.date,
      4: details.time,
      5: details.stylist,
    },
    actorId,
  });
}

export async function notifyAppointmentCancelled(
  appointmentId,
  { eventKeySuffix = "", actorId = null } = {}
) {
  const appointment = await loadAppointment(appointmentId);
  if (!appointment) return { success: false, skipped: true, reason: "appointment_not_found" };

  const details = appointmentDetails(appointment);
  const body = `Hi ${details.name}, your ${details.service} appointment scheduled for ${details.date} at ${details.time} has been cancelled.`;

  return sendAppointmentEvent({
    appointment,
    event: "appointment.cancelled",
    eventKey: `appointment.cancelled:${appointment._id}:${eventKeySuffix || appointment.cancelledAt || appointment.updatedAt}`,
    subject: "Appointment cancelled",
    body,
    html: `<p>Hi ${details.name},</p><p>Your <strong>${details.service}</strong> appointment scheduled for <strong>${details.date} at ${details.time}</strong> has been cancelled.</p>`,
    templateKey: "appointment_cancelled",
    templateVariables: {
      1: details.name,
      2: details.service,
      3: details.date,
      4: details.time,
    },
    actorId,
  });
}

export async function notifyAppointmentReminder(
  appointmentId,
  { hoursBefore = 24, eventKeySuffix = "", actorId = null } = {}
) {
  const appointment = await loadAppointment(appointmentId);
  if (!appointment) return { success: false, skipped: true, reason: "appointment_not_found" };
  if (appointment.customer?.communicationPreferences?.appointmentReminders === false) {
    return { success: true, skipped: true, reason: "appointment_reminders_disabled" };
  }

  const details = appointmentDetails(appointment);
  const body = `Hi ${details.name}, reminder: your ${details.service} appointment with ${details.stylist} is on ${details.date} at ${details.time}.`;
  const startKey = details.start?.toISOString() || text(appointment.appointmentDate);

  return sendAppointmentEvent({
    appointment,
    event: "appointment.reminder",
    eventKey: `appointment.reminder:${appointment._id}:${hoursBefore}:${eventKeySuffix || startKey}`,
    subject: `Appointment reminder - ${details.date} ${details.time}`,
    body,
    html: `<p>Hi ${details.name},</p><p>This is a reminder that your <strong>${details.service}</strong> appointment with <strong>${details.stylist}</strong> is on <strong>${details.date} at ${details.time}</strong>.</p>`,
    templateKey: "appointment_reminder",
    templateVariables: {
      1: details.name,
      2: details.service,
      3: details.stylist,
      4: details.date,
      5: details.time,
    },
    reminder: true,
    metadata: { hoursBefore },
    actorId,
  });
}

export async function notifyAppointmentPaymentRequest(
  appointmentId,
  {
    checkoutUrl,
    amount = null,
    purpose = "deposit",
    eventKeySuffix = "",
    actorId = null,
  } = {}
) {
  const appointment = await loadAppointment(appointmentId);
  if (!appointment) return { success: false, skipped: true, reason: "appointment_not_found" };

  const paymentUrl = text(checkoutUrl);
  if (!paymentUrl) {
    const error = new Error("A checkout URL is required for an appointment payment request.");
    error.statusCode = 400;
    error.code = "APPOINTMENT_PAYMENT_URL_REQUIRED";
    throw error;
  }

  const details = appointmentDetails(appointment);
  const requestedAmount = money(
    amount ?? appointment.balanceDue ?? appointment.finalPrice ?? appointment.totalPrice
  );
  const amountLabel = `Â£${requestedAmount.toFixed(2)}`;
  const purposeLabel = text(purpose).toLowerCase() === "deposit" ? "deposit" : "payment";
  const body = `Hi ${details.name}, a ${purposeLabel} of ${amountLabel} is requested for your ${details.service} appointment on ${details.date} at ${details.time}. Pay securely here: ${paymentUrl}`;

  return sendAppointmentEvent({
    appointment,
    event: "appointment.payment_requested",
    eventKey: `appointment.payment_requested:${appointment._id}:${purposeLabel}:${amountLabel}:${eventKeySuffix || paymentUrl}`,
    subject: `Appointment ${purposeLabel} request - ${amountLabel}`,
    body,
    html: `<p>Hi ${details.name},</p><p>A <strong>${purposeLabel} of ${amountLabel}</strong> is requested for your <strong>${details.service}</strong> appointment on <strong>${details.date} at ${details.time}</strong>.</p><p><a href="${paymentUrl}">Pay securely</a></p>`,
    templateKey: "appointment_payment_request",
    templateVariables: {
      1: details.name,
      2: purposeLabel,
      3: amountLabel,
      4: details.service,
      5: details.date,
      6: details.time,
      7: paymentUrl,
    },
    metadata: {
      paymentPurpose: purposeLabel,
      requestedAmount,
      checkoutUrl: paymentUrl,
    },
    actorId,
  });
}

export async function notifyAppointmentPaymentReceived(
  appointmentId,
  {
    amount = null,
    remainingBalance = null,
    eventKeySuffix = "",
    actorId = null,
  } = {}
) {
  const appointment = await loadAppointment(appointmentId);
  if (!appointment) return { success: false, skipped: true, reason: "appointment_not_found" };

  const details = appointmentDetails(appointment);
  const receivedAmount = money(amount ?? 0);
  const balance = money(remainingBalance ?? appointment.balanceDue ?? 0);
  const amountLabel = "Â£" + receivedAmount.toFixed(2);
  const balanceLabel = "Â£" + balance.toFixed(2);
  const balanceSentence = balance <= 0
    ? "Your appointment balance is now paid in full."
    : "Your remaining appointment balance is " + balanceLabel + ".";
  const body =
    "Hi " + details.name + " we received " + amountLabel +
    " for your " + details.service + " appointment on " + details.date +
    " at " + details.time + ". " + balanceSentence;

  return sendAppointmentEvent({
    appointment,
    event: "appointment.payment_received",
    eventKey:
      "appointment.payment_received:" + appointment._id + ":" +
      (eventKeySuffix || appointment.updatedAt),
    subject: "Appointment payment received - " + amountLabel,
    body,
    html:
      "<p>Hi " + details.name + "</p><p>We received <strong>" + amountLabel +
      "</strong> for your <strong>" + details.service +
      "</strong> appointment on <strong>" + details.date + " at " + details.time +
      "</strong>.</p><p>" + balanceSentence + "</p>",
    templateKey: "appointment_payment_received",
    templateVariables: {
      1: details.name,
      2: amountLabel,
      3: details.service,
      4: details.date,
      5: details.time,
      6: balanceLabel,
    },
    metadata: { receivedAmount, remainingBalance: balance },
    actorId,
  });
}
export async function notifyAppointmentPaymentFailed(
  appointmentId,
  {
    retryUrl = "",
    eventKeySuffix = "",
    actorId = null,
  } = {}
) {
  const appointment = await loadAppointment(appointmentId);
  if (!appointment) return { success: false, skipped: true, reason: "appointment_not_found" };

  const details = appointmentDetails(appointment);
  const safeRetryUrl = text(retryUrl);
  const retryText = safeRetryUrl ? ` Please retry securely here: ${safeRetryUrl}` : " Please contact the salon if you need help completing payment.";
  const body = `Hi ${details.name}, we could not complete the payment for your ${details.service} appointment on ${details.date} at ${details.time}.${retryText}`;

  return sendAppointmentEvent({
    appointment,
    event: "appointment.payment_failed",
    eventKey: `appointment.payment_failed:${appointment._id}:${eventKeySuffix || appointment.updatedAt}`,
    subject: "Appointment payment unsuccessful",
    body,
    html: `<p>Hi ${details.name},</p><p>We could not complete the payment for your <strong>${details.service}</strong> appointment on <strong>${details.date} at ${details.time}</strong>.</p>${safeRetryUrl ? `<p><a href="${safeRetryUrl}">Retry payment securely</a></p>` : "<p>Please contact the salon if you need help completing payment.</p>"}`,
    templateKey: "appointment_payment_failed",
    templateVariables: {
      1: details.name,
      2: details.service,
      3: details.date,
      4: details.time,
      5: safeRetryUrl || process.env.BOOKING_URL || process.env.FRONTEND_URL || "",
    },
    metadata: { retryUrl: safeRetryUrl || null },
    actorId,
  });
}

export async function notifySafely(notification, context = {}) {
  try {
    return await notification();
  } catch (error) {
    console.error("[SalonAI appointment notification]", {
      ...context,
      message: error?.message || "Appointment notification failed.",
      code: error?.code || "APPOINTMENT_NOTIFICATION_FAILED",
    });

    return {
      success: false,
      failed: true,
      error: {
        message: error?.message || "Appointment notification failed.",
        code: error?.code || "APPOINTMENT_NOTIFICATION_FAILED",
      },
    };
  }
}

export default {
  notifyAppointmentCancelled,
  notifyAppointmentConfirmed,
  notifyAppointmentPaymentFailed,
  notifyAppointmentPaymentReceived,
  notifyAppointmentPaymentRequest,
  notifyAppointmentReminder,
  notifyAppointmentRescheduled,
  notifySafely,
};
