import Payment from "./Payment.js";
import {
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
  constructStripeEvent,
} from "../../providers/paymentProvider.js";

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

export async function handleStripeCheckoutWebhook(
  rawBody,
  signature
) {
  const event =
    constructStripeEvent(
      rawBody,
      signature
    );

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

    return {
      received: true,
      handled: true,
      eventId:
        event.id || "",
      eventType: type,
      orderId:
        orderId || null,
      settled:
        Boolean(
          shouldSettle &&
          orderId
        ),
      pending:
        !shouldSettle,
    };
  }

  if (
    FAILURE_EVENT_TYPES.has(
      type
    )
  ) {
    await markFailed(
      session
    );

    return {
      received: true,
      handled: true,
      eventId:
        event.id || "",
      eventType: type,
      orderId:
        orderId || null,
      settled: false,
      failed: true,
    };
  }

  if (
    type ===
    "checkout.session.expired"
  ) {
    await markExpired(
      session
    );

    return {
      received: true,
      handled: true,
      eventId:
        event.id || "",
      eventType: type,
      orderId:
        orderId || null,
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
  };
}

export default {
  handleStripeCheckoutWebhook,
};
