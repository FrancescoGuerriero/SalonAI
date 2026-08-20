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
      `${frontendUrl}/account?payment=success&appointment=${appointment._id}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl:
      `${frontendUrl}/account?payment=cancelled&appointment=${appointment._id}`,
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

function checkoutReservationKey(
  appointmentId,
  purpose
) {
  return `appointment_checkout:${appointmentId}:${purpose}`;
}

function providerIdempotencyKey(paymentId) {
  return `salonai:appointment-payment:${paymentId}`;
}

async function reserveAppointmentPayment({
  appointment,
  purpose,
  amount,
  balance,
  actor,
  forceNew = false,
}) {
  const reservationKey =
    checkoutReservationKey(
      appointment._id,
      purpose
    );

  const cutoff =
    new Date(
      Date.now() -
        30 * 60 * 1000
    );

  let existing =
    await Payment.findOne({
      checkoutReservationKey:
        reservationKey,
    });

  if (existing) {
    const expired =
      existing.createdAt &&
      existing.createdAt < cutoff;

    if (
      forceNew !== true &&
      !expired
    ) {
      return {
        payment: existing,
        reused: true,
      };
    }

    const released =
      await Payment.updateOne(
        {
          _id: existing._id,
          checkoutReservationKey:
            reservationKey,
          status: "pending",
        },
        {
          $set: {
            status: "cancelled",
            rawStatus:
              "checkout_superseded",
            failureReason:
              "Superseded by a newer checkout request.",
          },
          $unset: {
            checkoutReservationKey: 1,
          },
        }
      );

    if (
      released.modifiedCount === 0
    ) {
      existing =
        await Payment.findOne({
          checkoutReservationKey:
            reservationKey,
        });

      if (existing) {
        return {
          payment: existing,
          reused: true,
        };
      }
    }
  }

  const paymentData = {
    customer:
      appointment.customer?._id ||
      undefined,

    appointment:
      appointment._id,

    purpose,

    checkoutReservationKey:
      reservationKey,

    amount,

    currency: "GBP",

    provider:
      paymentProviderMode(),

    status: "pending",

    metadata: {
      appointmentId:
        String(appointment._id),

      requestedBalance:
        balance,

      requestedBy:
        actorId(actor) || null,
    },
  };

  try {
    const payment =
      await Payment.create(
        paymentData
      );

    return {
      payment,
      reused: false,
    };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const winner =
      await Payment.findOne({
        checkoutReservationKey:
          reservationKey,
      });

    if (!winner) {
      throw error;
    }

    return {
      payment: winner,
      reused: true,
    };
  }
}

export async function prepareAppointmentPaymentReservation(
  appointmentId,
  payload = {},
  actor = null
) {
  const appointment =
    await loadAppointment(
      appointmentId
    );

  if (
    [
      "completed",
      "cancelled",
      "no_show",
    ].includes(
      appointment.status
    )
  ) {
    throw createServiceError(
      `A ${appointment.status} appointment cannot accept a new online payment.`,
      409
    );
  }

  const {
    purpose,
    amount,
    balance,
  } =
    calculateRequestedAmount(
      appointment,
      payload
    );

  const reservation =
    await reserveAppointmentPayment(
      {
        appointment,
        purpose,
        amount,
        balance,
        actor,
        forceNew:
          payload.forceNew === true,
      }
    );

  return {
    appointment,
    payment: reservation.payment,
    reused: reservation.reused,
    purpose,
    amount,
    balance,
  };
}

export async function releaseAppointmentPaymentReservation(
  paymentId,
  {
    status = "cancelled",
    rawStatus = "checkout_cancelled",
    failureReason = "",
  } = {}
) {
  if (!mongoose.isValidObjectId(paymentId)) {
    return null;
  }

  const payment = await Payment.findById(paymentId);
  if (!payment || payment.status === "paid") {
    return payment;
  }

  payment.status = status;
  payment.rawStatus = rawStatus;
  payment.failureReason = text(failureReason);
  payment.checkoutReservationKey = undefined;
  await payment.save();
  return payment;
}

export async function createAppointmentCheckout(
  appointmentId,
  payload = {},
  actor = null
) {
  const prepared =
    await prepareAppointmentPaymentReservation(
      appointmentId,
      payload,
      actor
    );

  const appointment =
    prepared.appointment;
  const payment =
    prepared.payment;

  /*
   * A completed provider checkout
   * already exists for this active
   * reservation. Reuse it instead of
   * creating another Stripe session.
   */
  if (
    payment.providerPaymentId ||
    payment.checkoutUrl
  ) {
    return {
      appointment:
        appointment.toObject(),

      payment:
        payment.toObject(),

      reused: true,

      requiresDemoConfirmation:
        payment.provider ===
        "console",
    };
  }

  /*
   * Use values persisted on the
   * reservation record. Concurrent
   * callers therefore submit identical
   * parameters to Stripe even when their
   * incoming payloads differ.
   */
  const reservedAmount =
    money(payment.amount);

  const reservedPurpose =
    payment.purpose;

  const urls =
    checkoutUrls(
      appointment
    );

  const customerEmail =
    text(
      appointment.customer?.email
    );

  const providerResult =
    await createAppointmentCheckoutPayment(
      {
        appointment,

        amount:
          reservedAmount,

        purpose:
          reservedPurpose,

        customerEmail,

        ...urls,

        idempotencyKey:
          providerIdempotencyKey(
            payment._id
          ),

        metadata: {
          customerId:
            appointment.customer?._id ||
            "",

          paymentId:
            String(payment._id),

          requestedBy:
            actorId(actor) || "",
        },
      }
    );

  payment.provider =
    providerResult.provider;

  payment.providerPaymentId =
    providerResult.providerPaymentId;

  payment.providerIntentId =
    providerResult.providerIntentId ||
    "";

  payment.checkoutUrl =
    providerResult.checkoutUrl ||
    "";

  payment.status =
    providerResult.status ||
    "pending";

  payment.rawStatus =
    providerResult.rawStatus ||
    "";

  await payment.save();

  if (
    providerResult.status ===
    "paid"
  ) {
    const settled =
      await settleAppointmentPayment(
        appointment._id,
        {
          paymentId:
            payment._id,

          providerPaymentId:
            providerResult.providerPaymentId,

          providerIntentId:
            providerResult.providerIntentId,

          rawStatus:
            providerResult.rawStatus,
        }
      );

    return {
      ...settled,

      reused:
        prepared.reused,

      requiresDemoConfirmation:
        false,
    };
  }

  if (
    providerResult.checkoutUrl
  ) {
    await notifySafely(
      () =>
        notifyAppointmentPaymentRequest(
          appointment._id,
          {
            checkoutUrl:
              providerResult.checkoutUrl,

            amount:
              reservedAmount,

            purpose:
              reservedPurpose ===
              "appointment_deposit"
                ? "deposit"
                : "balance",

            eventKeySuffix:
              String(payment._id),

            actorId:
              actorId(actor),
          }
        ),
      {
        appointmentId:
          String(
            appointment._id
          ),

        paymentId:
          String(
            payment._id
          ),
      }
    );
  }

  return {
    appointment:
      appointment.toObject(),

    payment:
      payment.toObject(),

    reused:
      prepared.reused,

    requiresDemoConfirmation:
      payment.provider ===
      "console",
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
  payment.checkoutReservationKey = undefined;

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
  payment.checkoutReservationKey = undefined;
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
  prepareAppointmentPaymentReservation,
  releaseAppointmentPaymentReservation,
  settleAppointmentPayment,
};
