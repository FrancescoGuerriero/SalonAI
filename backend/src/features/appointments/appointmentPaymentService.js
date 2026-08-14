import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Payment from "../commerce/Payment.js";
import {
  createAppointmentCheckoutPayment,
  paymentProviderMode,
} from "../../providers/paymentProvider.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  notifyAppointmentPaymentFailed,
  notifyAppointmentPaymentRequest,
  notifySafely,
} from "./appointmentNotificationService.js";

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function text(value) {
  return String(value ?? "").trim();
}

function actorId(actor) {
  const value = actor?._id || actor?.id || actor || null;
  return mongoose.isValidObjectId(value) ? value : null;
}

function depositPercentage() {
  const configured = Number(process.env.APPOINTMENT_DEPOSIT_PERCENTAGE || 25);
  if (!Number.isFinite(configured)) return 25;
  return Math.min(100, Math.max(1, configured));
}

function checkoutUrls(appointment) {
  const frontendUrl = String(
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/$/, "");

  return {
    successUrl:
      `${frontendUrl}/appointments/${appointment._id}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl:
      `${frontendUrl}/appointments/${appointment._id}?payment=cancelled`,
  };
}

function paymentPurpose(value) {
  const normalised = text(value).toLowerCase();
  return normalised === "balance"
    ? "appointment_balance"
    : "appointment_deposit";
}

function calculateRequestedAmount(appointment, payload = {}) {
  const purpose = paymentPurpose(payload.purpose);
  const balance = money(
    appointment.balanceDue > 0
      ? appointment.balanceDue
      : Math.max(
          0,
          Number(appointment.finalPrice || appointment.totalPrice || 0) -
            Number(appointment.amountPaid || 0)
        )
  );

  if (balance <= 0) {
    throw createServiceError(
      "This appointment has no outstanding balance.",
      409
    );
  }

  let amount;
  if (payload.amount !== undefined && payload.amount !== null && payload.amount !== "") {
    amount = money(Number(payload.amount));
  } else if (purpose === "appointment_balance") {
    amount = balance;
  } else {
    amount = money(
      Math.min(
        balance,
        Math.max(0.01, balance * (depositPercentage() / 100))
      )
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createServiceError(
      "Appointment payment amount must be greater than zero.",
      400
    );
  }

  if (amount > balance) {
    throw createServiceError(
      `Appointment payment amount exceeds the outstanding balance of £${balance.toFixed(2)}.`,
      409
    );
  }

  return { purpose, amount, balance };
}

async function loadAppointment(appointmentId) {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw createServiceError("Invalid appointment ID.", 400);
  }

  return assertFound(
    await Appointment.findById(appointmentId)
      .populate(
        "customer",
        "firstName lastName preferredName email phone alternativePhone phoneNumber mobile"
      )
      .populate("service", "name price duration"),
    "Appointment not found."
  );
}

async function recentPendingPayment(appointmentId, purpose) {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);

  return Payment.findOne({
    appointment: appointmentId,
    purpose,
    status: "pending",
    createdAt: { $gte: cutoff },
  }).sort({ createdAt: -1 });
}

export async function createAppointmentCheckout(
  appointmentId,
  payload = {},
  actor = null
) {
  const appointment = await loadAppointment(appointmentId);

  if (["completed", "cancelled", "no_show"].includes(appointment.status)) {
    throw createServiceError(
      `A ${appointment.status} appointment cannot accept a new online payment.`,
      409
    );
  }

  const { purpose, amount, balance } = calculateRequestedAmount(
    appointment,
    payload
  );

  if (payload.forceNew !== true) {
    const existing = await recentPendingPayment(appointment._id, purpose);
    if (existing) {
      return {
        appointment: appointment.toObject(),
        payment: existing.toObject(),
        reused: true,
        requiresDemoConfirmation: existing.provider === "console",
      };
    }
  }

  const urls = checkoutUrls(appointment);
  const customerEmail = text(appointment.customer?.email);

  const providerResult = await createAppointmentCheckoutPayment({
    appointment,
    amount,
    purpose,
    customerEmail,
    ...urls,
    metadata: {
      customerId: appointment.customer?._id || "",
      requestedBy: actorId(actor) || "",
    },
  });

  const payment = await Payment.create({
    customer: appointment.customer?._id || undefined,
    appointment: appointment._id,
    purpose,
    amount,
    currency: "GBP",
    provider: providerResult.provider,
    providerPaymentId: providerResult.providerPaymentId,
    providerIntentId: providerResult.providerIntentId || "",
    checkoutUrl: providerResult.checkoutUrl || "",
    status: providerResult.status || "pending",
    rawStatus: providerResult.rawStatus || "",
    metadata: {
      appointmentId: String(appointment._id),
      requestedBalance: balance,
      requestedBy: actorId(actor) || null,
    },
  });

  if (providerResult.status === "paid") {
    await settleAppointmentPayment(appointment._id, {
      paymentId: payment._id,
      providerPaymentId: providerResult.providerPaymentId,
      providerIntentId: providerResult.providerIntentId,
      rawStatus: providerResult.rawStatus,
    });
  } else if (providerResult.checkoutUrl) {
    await notifySafely(
      () =>
        notifyAppointmentPaymentRequest(appointment._id, {
          checkoutUrl: providerResult.checkoutUrl,
          amount,
          purpose:
            purpose === "appointment_deposit"
              ? "deposit"
              : "balance",
          eventKeySuffix: String(payment._id),
          actorId: actorId(actor),
        }),
      {
        appointmentId: String(appointment._id),
        paymentId: String(payment._id),
      }
    );
  }

  return {
    appointment: appointment.toObject(),
    payment: payment.toObject(),
    reused: false,
    requiresDemoConfirmation: payment.provider === "console",
  };
}

export async function settleAppointmentPayment(
  appointmentId,
  providerData = {}
) {
  const appointment = await loadAppointment(appointmentId);

  let payment = null;
  if (mongoose.isValidObjectId(providerData.paymentId)) {
    payment = await Payment.findById(providerData.paymentId);
  }

  if (!payment && providerData.providerPaymentId) {
    payment = await Payment.findOne({
      appointment: appointment._id,
      providerPaymentId: providerData.providerPaymentId,
    });
  }

  if (!payment && providerData.providerIntentId) {
    payment = await Payment.findOne({
      appointment: appointment._id,
      providerIntentId: providerData.providerIntentId,
    });
  }

  payment = assertFound(payment, "Appointment payment record not found.");

  if (payment.status === "paid") {
    return { appointment: appointment.toObject(), payment: payment.toObject() };
  }

  const paidAmount = money(payment.amount);
  const currentPaid = money(appointment.amountPaid);
  const totalDue = money(
    appointment.finalPrice || appointment.totalPrice || currentPaid + paidAmount
  );
  const nextPaid = money(Math.min(totalDue, currentPaid + paidAmount));
  const nextBalance = money(Math.max(0, totalDue - nextPaid));
  const paidAt = new Date();

  appointment.amountPaid = nextPaid;
  appointment.balanceDue = nextBalance;
  appointment.paymentMethod = "stripe";
  appointment.paymentStatus =
    nextBalance <= 0 ? "paid" : "partially_paid";
  appointment.stripePaymentIntentId =
    providerData.providerIntentId ||
    payment.providerIntentId ||
    appointment.stripePaymentIntentId ||
    null;

  payment.status = "paid";
  payment.paidAt = paidAt;
  payment.providerPaymentId =
    providerData.providerPaymentId || payment.providerPaymentId;
  payment.providerIntentId =
    providerData.providerIntentId || payment.providerIntentId || "";
  payment.rawStatus = providerData.rawStatus || "paid";
  payment.failureReason = "";

  await Promise.all([appointment.save(), payment.save()]);

  return {
    appointment: appointment.toObject(),
    payment: payment.toObject(),
  };
}

export async function failAppointmentPayment(
  appointmentId,
  providerData = {}
) {
  const appointment = await loadAppointment(appointmentId);

  const payment = providerData.providerPaymentId
    ? await Payment.findOne({
        appointment: appointment._id,
        providerPaymentId: providerData.providerPaymentId,
      })
    : null;

  if (!payment || payment.status === "paid") {
    return { appointment: appointment.toObject(), payment: payment?.toObject() || null };
  }

  payment.status = "failed";
  payment.rawStatus = providerData.rawStatus || "failed";
  payment.failureReason =
    text(providerData.failureReason) ||
    "Stripe reported that the appointment payment failed.";
  await payment.save();

  await notifySafely(
    () =>
      notifyAppointmentPaymentFailed(appointment._id, {
        retryUrl: text(providerData.retryUrl),
        eventKeySuffix: providerData.eventKey || String(payment._id),
      }),
    {
      appointmentId: String(appointment._id),
      paymentId: String(payment._id),
    }
  );

  return {
    appointment: appointment.toObject(),
    payment: payment.toObject(),
  };
}

export async function confirmDemoAppointmentPayment(
  appointmentId,
  paymentId
) {
  if (
    paymentProviderMode() !== "console" ||
    process.env.NODE_ENV === "production"
  ) {
    throw createServiceError(
      "Demo appointment payment confirmation is not available.",
      403
    );
  }

  if (!mongoose.isValidObjectId(paymentId)) {
    throw createServiceError("Invalid payment ID.", 400);
  }

  const payment = assertFound(
    await Payment.findOne({
      _id: paymentId,
      appointment: appointmentId,
      provider: "console",
    }),
    "Demo appointment payment not found."
  );

  return settleAppointmentPayment(appointmentId, {
    paymentId: payment._id,
    providerPaymentId: payment.providerPaymentId,
    rawStatus: "demo_paid",
  });
}

export default {
  confirmDemoAppointmentPayment,
  createAppointmentCheckout,
  failAppointmentPayment,
  settleAppointmentPayment,
};
