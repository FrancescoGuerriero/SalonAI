import mongoose from "mongoose";

import Order from "./Order.js";
import Payment from "./Payment.js";
import { refundProviderPayment } from "../../providers/paymentProvider.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normaliseRefundStatus(value) {
  const status = String(value || "pending").toLowerCase();

  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  if (status === "canceled" || status === "cancelled") return "cancelled";
  return "pending";
}

function acceptedRefundAmount(payment) {
  return money(
    (payment.refunds || [])
      .filter((refund) => ["pending", "succeeded"].includes(refund.status))
      .reduce((sum, refund) => sum + Number(refund.amount || 0), 0)
  );
}

function succeededRefundAmount(payment) {
  return money(
    (payment.refunds || [])
      .filter((refund) => refund.status === "succeeded")
      .reduce((sum, refund) => sum + Number(refund.amount || 0), 0)
  );
}

function applyPaymentRefundState(payment) {
  const completed = succeededRefundAmount(payment);
  payment.refundedAmount = completed;

  if (completed >= money(payment.amount)) {
    payment.status = "refunded";
    payment.refundedAt = payment.refundedAt || new Date();
  } else if (completed > 0) {
    payment.status = "partially_refunded";
  }
}

async function applyOrderRefundState(order, payment) {
  if (payment.status === "refunded") {
    order.status = "refunded";
    await order.save();
  }
}

export async function refundOrder(orderId, payload = {}, actor = {}) {
  if (!mongoose.isValidObjectId(orderId)) {
    throw createServiceError("Invalid order ID.", 400);
  }

  const order = assertFound(
    await Order.findById(orderId).populate("payment"),
    "Order not found."
  );

  if (!order.payment) {
    throw createServiceError("This order has no payment record.", 409);
  }

  if (!["paid", "processing", "ready", "completed"].includes(order.status)) {
    throw createServiceError(
      "Only paid or fulfilled orders can be refunded.",
      409
    );
  }

  const payment = order.payment;
  if (!["paid", "partially_refunded"].includes(payment.status)) {
    throw createServiceError(
      "This payment is not currently refundable.",
      409
    );
  }

  const reserved = acceptedRefundAmount(payment);
  const remaining = money(Math.max(0, Number(payment.amount) - reserved));
  if (remaining <= 0) {
    throw createServiceError(
      "This payment has no remaining refundable amount.",
      409
    );
  }

  const requestedAmount = payload.amount === undefined || payload.amount === null
    ? remaining
    : money(Number(payload.amount));

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw createServiceError("Refund amount must be greater than zero.", 400);
  }

  if (requestedAmount > remaining) {
    throw createServiceError(
      `Refund amount exceeds the remaining refundable balance of £${remaining.toFixed(2)}.`,
      409
    );
  }

  const reason = String(payload.reason || "requested_by_customer")
    .trim()
    .toLowerCase();

  const result = await refundProviderPayment({
    providerIntentId: payment.providerIntentId,
    amount: requestedAmount,
    currency: payment.currency,
    reason,
    metadata: {
      paymentId: payment._id,
      orderId: order._id,
      orderNumber: order.orderNumber,
      requestedBy: actor?._id || "",
    },
  });

  const refundStatus = normaliseRefundStatus(result.status);
  payment.refunds.push({
    providerRefundId: result.providerRefundId,
    amount: money(result.amount || requestedAmount),
    currency: result.currency || payment.currency,
    status: refundStatus,
    reason: result.reason || reason,
    failureReason: result.failureReason || "",
    requestedBy: actor?._id || undefined,
    requestedAt: new Date(),
    completedAt: refundStatus === "succeeded" ? new Date() : null,
  });
  payment.rawStatus = result.rawStatus || `refund_${refundStatus}`;

  applyPaymentRefundState(payment);
  await payment.save();
  await applyOrderRefundState(order, payment);

  return {
    order: order.toObject(),
    payment: payment.toObject(),
    refund: payment.refunds[payment.refunds.length - 1],
    remainingRefundableAmount: money(
      Math.max(0, Number(payment.amount) - acceptedRefundAmount(payment))
    ),
  };
}

export async function reconcileStripeRefund(refund = {}) {
  const providerRefundId = String(refund.id || "").trim();
  const providerIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id || "";
  const metadataPaymentId = String(refund.metadata?.paymentId || "").trim();

  let payment = null;
  if (mongoose.isValidObjectId(metadataPaymentId)) {
    payment = await Payment.findById(metadataPaymentId);
  }
  if (!payment && providerIntentId) {
    payment = await Payment.findOne({ providerIntentId });
  }
  if (!payment) {
    return { reconciled: false, reason: "payment_not_found" };
  }

  const status = normaliseRefundStatus(refund.status);
  const amount = money(Number(refund.amount || 0) / 100);
  let entry = (payment.refunds || []).find(
    (item) => item.providerRefundId === providerRefundId
  );

  if (!entry) {
    payment.refunds.push({
      providerRefundId,
      amount,
      currency: String(refund.currency || payment.currency).toUpperCase(),
      status,
      reason: refund.reason || "requested_by_customer",
      failureReason: refund.failure_reason || "",
      requestedAt: refund.created
        ? new Date(Number(refund.created) * 1000)
        : new Date(),
      completedAt: status === "succeeded" ? new Date() : null,
    });
    entry = payment.refunds[payment.refunds.length - 1];
  } else {
    entry.status = status;
    entry.failureReason = refund.failure_reason || "";
    if (status === "succeeded" && !entry.completedAt) {
      entry.completedAt = new Date();
    }
  }

  payment.rawStatus = `refund_${status}`;
  applyPaymentRefundState(payment);
  await payment.save();

  if (payment.order) {
    const order = await Order.findById(payment.order);
    if (order) {
      await applyOrderRefundState(order, payment);
    }
  }

  return {
    reconciled: true,
    paymentId: String(payment._id),
    orderId: payment.order ? String(payment.order) : null,
    providerRefundId,
    status,
  };
}

export default {
  refundOrder,
  reconcileStripeRefund,
};
