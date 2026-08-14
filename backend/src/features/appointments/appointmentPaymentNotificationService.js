import Appointment from "../../models/Appointment.js";
import Payment from "../commerce/Payment.js";
import { sendTransactionalNotification } from "../../services/transactionalNotificationService.js";

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
    "Customer"
  );
}

function channelsFor(customer) {
  const preferences = customer?.communicationPreferences || {};
  if (preferences.unsubscribed === true) return [];

  const channels = [];
  if (customer?.email && preferences.emailUnsubscribed !== true) {
    channels.push("email");
  }

  const preferred = text(preferences.preferredChannel).toLowerCase();
  const phone = text(
    customer?.phone ||
      customer?.alternativePhone ||
      customer?.phoneNumber ||
      customer?.mobile
  );

  if (preferred === "sms" && phone && preferences.smsUnsubscribed !== true) {
    channels.push("sms");
  }
  if (preferred === "whatsapp" && phone) {
    channels.push("whatsapp");
  }

  return [...new Set(channels)];
}

export async function notifyAppointmentPaymentReceived(
  appointmentId,
  paymentId
) {
  const [appointment, payment] = await Promise.all([
    Appointment.findById(appointmentId)
      .populate(
        "customer",
        "firstName lastName preferredName email phone alternativePhone phoneNumber mobile communicationPreferences"
      )
      .populate("service", "name")
      .lean(),
    Payment.findById(paymentId).lean(),
  ]);

  if (!appointment || !payment) {
    return {
      success: false,
      skipped: true,
      reason: "appointment_or_payment_not_found",
    };
  }

  const channels = channelsFor(appointment.customer);
  if (channels.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: "no_enabled_channels",
    };
  }

  const name = customerName(appointment.customer);
  const service = text(appointment.service?.name) || "your salon appointment";
  const amount = `£${money(payment.amount).toFixed(2)}`;
  const remaining = `£${money(appointment.balanceDue).toFixed(2)}`;
  const purpose =
    payment.purpose === "appointment_deposit"
      ? "deposit"
      : "payment";

  const body = appointment.balanceDue > 0
    ? `Hi ${name}, we received your ${purpose} of ${amount} for ${service}. Your remaining balance is ${remaining}.`
    : `Hi ${name}, we received your ${purpose} of ${amount} for ${service}. Your appointment balance is now fully paid.`;

  return sendTransactionalNotification({
    event: "appointment.payment_received",
    eventKey: `appointment.payment_received:${appointment._id}:${payment._id}`,
    channels,
    recipient: {
      name,
      email: text(appointment.customer?.email),
      phone: text(
        appointment.customer?.phone ||
          appointment.customer?.alternativePhone ||
          appointment.customer?.phoneNumber ||
          appointment.customer?.mobile
      ),
    },
    subject: `Appointment payment received - ${amount}`,
    text: body,
    html: appointment.balanceDue > 0
      ? `<p>Hi ${name},</p><p>We received your <strong>${purpose} of ${amount}</strong> for <strong>${service}</strong>.</p><p>Your remaining balance is <strong>${remaining}</strong>.</p>`
      : `<p>Hi ${name},</p><p>We received your <strong>${purpose} of ${amount}</strong> for <strong>${service}</strong>.</p><p>Your appointment balance is now fully paid.</p>`,
    whatsapp: {
      body,
      contentSid: process.env.TWILIO_WHATSAPP_APPOINTMENT_PAYMENT_RECEIVED_CONTENT_SID || "",
      contentVariables: {
        1: name,
        2: purpose,
        3: amount,
        4: service,
        5: remaining,
      },
    },
    customerId: appointment.customer?._id || null,
    metadata: {
      appointmentId: String(appointment._id),
      paymentId: String(payment._id),
      amount: payment.amount,
      balanceDue: appointment.balanceDue,
      paymentPurpose: payment.purpose,
    },
  });
}

export default {
  notifyAppointmentPaymentReceived,
};
