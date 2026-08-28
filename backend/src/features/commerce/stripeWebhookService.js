import Payment from "./Payment.js";
import {
  cancelPendingOrderCheckout,
  settlePaidOrder,
} from "./commerceService.js";
import {
  reconcileStripeRefund,
} from "./orderRefundService.js";
import {
  notifyOrderPaid,
  notifyOrderRefunded,
  notifySafely,
} from "./commerceNotificationService.js";
import {
  failAppointmentPayment,
  settleAppointmentPayment,
} from "../appointments/appointmentPaymentService.js";
import {
  notifyAppointmentPaymentReceived,
} from "../appointments/appointmentPaymentNotificationService.js";
import {
  constructStripeEvent,
} from "../../providers/paymentProvider.js";
import {
  claimStripeWebhookEvent,
  markStripeWebhookEventFailed,
  markStripeWebhookEventProcessed,
} from "./stripeWebhookEventService.js";

const SUCCESS_EVENT_TYPES =
  new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ]);

const FAILURE_EVENT_TYPES =
  new Set([
    "checkout.session.async_payment_failed",
  ]);

const REFUND_EVENT_TYPES =
  new Set([
    "refund.created",
    "refund.updated",
    "refund.failed",
  ]);

function sessionOrderId(
  session = {}
) {
  return String(
    session.metadata
      ?.orderId ||
      ""
  ).trim();
}

function sessionAppointmentId(
  session = {}
) {
  return String(
    session.metadata
      ?.appointmentId ||
      ""
  ).trim();
}

function sessionIntentId(
  session = {}
) {
  return (
    typeof session
      .payment_intent ===
      "string"
      ? session
          .payment_intent
      : session
          .payment_intent
          ?.id || ""
  );
}

async function findSessionPayment(
  session
) {
  return Payment.findOne({
    providerPaymentId:
      session.id,
  });
}

async function markFailed(
  session
) {
  const payment =
    await findSessionPayment(
      session
    );

  if (
    !payment ||
    [
      "paid",
      "refunded",
      "partially_refunded",
    ].includes(
      payment.status
    )
  ) {
    return payment;
  }

  payment.status =
    "failed";
  payment.rawStatus =
    session
      .payment_status ||
    session.status ||
    "failed";
  payment.failureReason =
    "Stripe reported that the asynchronous Checkout payment failed.";
  payment.checkoutReservationKey =
    undefined;

  await payment.save();

  return payment;
}

async function markExpired(
  session
) {
  const payment =
    await findSessionPayment(
      session
    );

  if (
    !payment ||
    payment.status !==
      "pending"
  ) {
    return payment;
  }

  payment.status =
    "cancelled";
  payment.rawStatus =
    session.status ||
    "expired";

  /*
   * Expired Checkout Sessions must release
   * their reservation so the customer can
   * start a fresh payment attempt.
   */
  payment.checkoutReservationKey =
    undefined;

  await payment.save();

  return payment;
}

function completedSessionIsPaid(
  session
) {
  return [
    "paid",
    "no_payment_required",
  ].includes(
    String(
      session
        ?.payment_status ||
        ""
    )
      .trim()
      .toLowerCase()
  );
}

async function processStripeCheckoutEvent(
  event
) {
  const type =
    String(
      event.type || ""
    );

  const object =
    event.data?.object ||
    {};

  if (REFUND_EVENT_TYPES.has(type)) {
    const reconciliation =
      await reconcileStripeRefund(
        object
      );

    if (
      reconciliation.reconciled &&
      reconciliation.status === "succeeded" &&
      reconciliation.orderId
    ) {
      await notifySafely(
        () => notifyOrderRefunded(
          reconciliation.orderId,
          reconciliation.paymentId,
          reconciliation.providerRefundId
        ),
        {
          eventType: type,
          eventId: event.id || "",
          orderId: reconciliation.orderId,
          paymentId: reconciliation.paymentId,
          providerRefundId:
            reconciliation.providerRefundId,
        }
      );
    }

    return {
      received: true,
      handled: true,
      eventId:
        event.id || "",
      eventType: type,
      ...reconciliation,
    };
  }

  const session = object;
  const orderId =
    sessionOrderId(
      session
    );
  const appointmentId =
    sessionAppointmentId(
      session
    );

  if (
    SUCCESS_EVENT_TYPES.has(
      type
    )
  ) {
    const shouldSettle =
      type ===
        "checkout.session.async_payment_succeeded" ||
      completedSessionIsPaid(
        session
      );

    let settled = false;
    let paymentId = null;

    if (
      shouldSettle &&
      orderId
    ) {
      await settlePaidOrder(
        orderId,
        {
          providerPaymentId:
            session.id,
          providerIntentId:
            sessionIntentId(
              session
            ),
          rawStatus:
            session
              .payment_status ||
            session.status ||
            "paid",
        }
      );

      settled = true;

      await notifySafely(
        () => notifyOrderPaid(
          orderId
        ),
        {
          eventType: type,
          eventId: event.id || "",
          orderId,
          providerPaymentId:
            session.id || "",
        }
      );
    }

    if (
      shouldSettle &&
      appointmentId
    ) {
      const result =
        await settleAppointmentPayment(
          appointmentId,
          {
            providerPaymentId:
              session.id,
            providerIntentId:
              sessionIntentId(
                session
              ),
            rawStatus:
              session
                .payment_status ||
              session.status ||
              "paid",
          }
        );

      paymentId =
        result.payment?._id
          ? String(result.payment._id)
          : null;
      settled = true;

      if (paymentId) {
        await notifySafely(
          () =>
            notifyAppointmentPaymentReceived(
              appointmentId,
              paymentId
            ),
          {
            eventType: type,
            eventId: event.id || "",
            appointmentId,
            paymentId,
            providerPaymentId:
              session.id || "",
          }
        );
      }
    }

    return {
      received: true,
      handled: true,
      eventId:
        event.id || "",
      eventType: type,
      orderId:
        orderId || null,
      appointmentId:
        appointmentId || null,
      paymentId,
      settled,
      pending:
        !shouldSettle,
    };
  }

  if (
    FAILURE_EVENT_TYPES.has(
      type
    )
  ) {
    if (orderId) {
      await cancelPendingOrderCheckout(orderId, {
        paymentStatus: "failed",
        rawStatus:
          session.payment_status ||
          session.status ||
          "failed",
        failureReason:
          "Stripe reported that the asynchronous Checkout payment failed.",
      });
    } else if (appointmentId) {
      await failAppointmentPayment(
        appointmentId,
        {
          providerPaymentId:
            session.id,
          rawStatus:
            session
              .payment_status ||
            session.status ||
            "failed",
          eventKey:
            event.id ||
            session.id,
        }
      );
    } else {
      await markFailed(
        session
      );
    }

    return {
      received: true,
      handled: true,
      eventId:
        event.id || "",
      eventType: type,
      orderId:
        orderId || null,
      appointmentId:
        appointmentId || null,
      settled: false,
      failed: true,
    };
  }

  if (
    type ===
    "checkout.session.expired"
  ) {
    if (orderId) {
      await cancelPendingOrderCheckout(orderId, {
        paymentStatus: "cancelled",
        rawStatus:
          session.status ||
          "expired",
        failureReason:
          "Stripe Checkout session expired before payment completed.",
      });
    } else {
      await markExpired(
        session
      );
    }

    return {
      received: true,
      handled: true,
      eventId:
        event.id || "",
      eventType: type,
      orderId:
        orderId || null,
      appointmentId:
        appointmentId || null,
      settled: false,
      expired: true,
    };
  }

  return {
    received: true,
    handled: false,
    eventId:
      event.id || "",
    eventType: type,
    orderId:
      orderId || null,
    appointmentId:
      appointmentId || null,
  };
}

export async function handleStripeCheckoutWebhook(
  rawBody,
  signature
) {
  /*
   * Verify the Stripe signature before accepting
   * anything into the persistent event ledger.
   */
  const event =
    constructStripeEvent(
      rawBody,
      signature
    );

  const claim =
    await claimStripeWebhookEvent(
      event
    );

  /*
   * A previously completed Stripe event is
   * acknowledged without repeating settlement,
   * inventory or notification side effects.
   */
  if (!claim.claimed) {
    return {
      received: true,
      handled: true,
      duplicate: true,
      eventId:
        event.id || "",
      eventType:
        String(
          event.type || ""
        ),
    };
  }

  try {
    const result =
      await processStripeCheckoutEvent(
        event
      );

    await markStripeWebhookEventProcessed(
      event.id,
      claim.claimId
    );

    return {
      ...result,
      duplicate: false,
    };
  } catch (error) {
    try {
      await markStripeWebhookEventFailed(
        event.id,
        claim.claimId,
        error
      );
    } catch (ledgerError) {
      console.error(
        "Failed to persist Stripe webhook failure state.",
        ledgerError
      );
    }

    throw error;
  }
}

export default {
  handleStripeCheckoutWebhook,
};
