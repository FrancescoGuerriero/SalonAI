import {
  createAppointmentCheckout,
} from "./appointmentPaymentService.js";

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

/**
 * Provider-neutral payment-link/Text2Pay contract.
 *
 * Payment remains the canonical payment/checkout record and the existing
 * appointment notification service remains the canonical delivery path.
 * This adapter deliberately does not create a second payment-link store or
 * bypass Stripe/Twilio/SendGrid communication governance.
 */
export async function createAppointmentPaymentRequest(
  appointmentId,
  payload = {},
  actor = null
) {
  const result = await createAppointmentCheckout(
    appointmentId,
    payload,
    actor
  );

  const payment = result.payment || {};

  return {
    paymentRequest: {
      id: payment._id || payment.id,
      sourceType: "appointment",
      sourceId: appointmentId,
      purpose:
        payment.purpose === "appointment_balance"
          ? "balance"
          : "deposit",
      amount: money(payment.amount),
      currency: payment.currency || "GBP",
      provider: payment.provider || "",
      checkoutUrl: payment.checkoutUrl || "",
      status: payment.status || "pending",
      deliveryMode: "customer_transactional_preference",
      reusable: true,
    },
    appointment: result.appointment,
    payment: result.payment,
    reused: result.reused === true,
    requiresDemoConfirmation:
      result.requiresDemoConfirmation === true,
  };
}

export default {
  createAppointmentPaymentRequest,
};
