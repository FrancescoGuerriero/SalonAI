import Order from "./Order.js";
import Payment from "./Payment.js";
import { sendTransactionalNotification } from "../../services/transactionalNotificationService.js";
import { resolveWhatsAppEventTemplate } from "../../providers/whatsapp/whatsappTemplateResolver.js";

function text(value) {
  return String(value ?? "").trim();
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function customerName(customer, fallback = "Customer") {
  const name = [customer?.firstName, customer?.lastName]
    .map(text)
    .filter(Boolean)
    .join(" ");
  return name || text(fallback) || "Customer";
}

function preferredChannels(order) {
  const customer = order.customer;
  const preferences = customer?.communicationPreferences || {};
  const channels = [];

  if (order.contact?.email && preferences.emailUnsubscribed !== true) {
    channels.push("email");
  }

  if (preferences.serviceUpdates === false || preferences.unsubscribed === true) {
    return channels;
  }

  const preferred = text(preferences.preferredChannel).toLowerCase();
  if (["sms", "whatsapp"].includes(preferred) && order.contact?.phone) {
    channels.push(preferred);
  }

  return [...new Set(channels)];
}

async function loadOrder(orderId) {
  return Order.findById(orderId)
    .populate(
      "customer",
      "firstName lastName email phone alternativePhone communicationPreferences"
    )
    .lean();
}

export async function notifyOrderPaid(orderId) {
  const order = await loadOrder(orderId);
  if (!order) return { success: false, skipped: true, reason: "order_not_found" };

  const channels = preferredChannels(order);
  if (channels.length === 0) {
    return { success: true, skipped: true, reason: "no_enabled_channels" };
  }

  const name = customerName(order.customer, order.contact?.name);
  const amount = money(order.total).toFixed(2);
  const fulfilment = order.fulfilmentType === "delivery" ? "delivery" : "collection";
  const body = `Hi ${name}, payment of Â£${amount} for SalonAI order ${order.orderNumber} has been received. Your order is now being prepared for ${fulfilment}.`;

  return sendTransactionalNotification({
    event: "commerce.order_paid",
    eventKey: `commerce.order_paid:${order._id}`,
    channels,
    recipient: {
      name,
      email: order.contact?.email || order.customer?.email || "",
      phone: order.contact?.phone || order.customer?.phone || order.customer?.alternativePhone || "",
    },
    subject: `Payment received - ${order.orderNumber}`,
    text: body,
    html: `<p>Hi ${name},</p><p>Payment of <strong>Â£${amount}</strong> for order <strong>${order.orderNumber}</strong> has been received.</p><p>Your order is now being prepared for ${fulfilment}.</p>`,
    whatsapp: {
      body,
      template: resolveWhatsAppEventTemplate("order_paid"),
      contentVariables: {
        1: name,
        2: order.orderNumber,
        3: `Â£${amount}`,
        4: fulfilment,
      },
    },
    customerId: order.customer?._id || null,
    metadata: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: order.total,
      currency: order.currency,
    },
  });
}

export async function notifyOrderRefunded(
  orderId,
  paymentId = null,
  refundKey = ""
) {
  const order = await loadOrder(orderId);
  if (!order) return { success: false, skipped: true, reason: "order_not_found" };

  const payment = paymentId
    ? await Payment.findById(paymentId).lean()
    : order.payment
      ? await Payment.findById(order.payment).lean()
      : null;

  const channels = preferredChannels(order);
  if (channels.length === 0) {
    return { success: true, skipped: true, reason: "no_enabled_channels" };
  }

  const name = customerName(order.customer, order.contact?.name);
  const refundedAmount = money(payment?.refundedAmount || order.total).toFixed(2);
  const fullRefund = payment?.status === "refunded";
  const refundLabel = fullRefund ? "refund" : "partial refund";
  const body = `Hi ${name}, a ${refundLabel} of Â£${refundedAmount} has been recorded for SalonAI order ${order.orderNumber}. Your bank or card provider may take additional time to display the funds.`;
  const safeRefundKey = text(refundKey) || `${payment?._id || order._id}:${refundedAmount}:${fullRefund}`;

  return sendTransactionalNotification({
    event: fullRefund ? "commerce.order_refunded" : "commerce.order_partially_refunded",
    eventKey: `commerce.refund:${safeRefundKey}`,
    channels,
    recipient: {
      name,
      email: order.contact?.email || order.customer?.email || "",
      phone: order.contact?.phone || order.customer?.phone || order.customer?.alternativePhone || "",
    },
    subject: `${fullRefund ? "Refund" : "Partial refund"} - ${order.orderNumber}`,
    text: body,
    html: `<p>Hi ${name},</p><p>A ${refundLabel} of <strong>Â£${refundedAmount}</strong> has been recorded for order <strong>${order.orderNumber}</strong>.</p><p>Your bank or card provider may take additional time to display the funds.</p>`,
    whatsapp: {
      body,
      template: resolveWhatsAppEventTemplate("refund"),
      contentVariables: {
        1: name,
        2: order.orderNumber,
        3: `Â£${refundedAmount}`,
        4: refundLabel,
      },
    },
    customerId: order.customer?._id || null,
    metadata: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      paymentId: payment?._id ? String(payment._id) : null,
      refundKey: safeRefundKey,
      refundedAmount: payment?.refundedAmount || order.total,
      currency: payment?.currency || order.currency,
      fullRefund,
    },
  });
}

export async function notifySafely(notification, context = {}) {
  try {
    return await notification();
  } catch (error) {
    console.error("[SalonAI commerce notification]", {
      ...context,
      message: error?.message || "Notification failed.",
      code: error?.code || "COMMERCE_NOTIFICATION_FAILED",
    });
    return {
      success: false,
      failed: true,
      error: {
        message: error?.message || "Notification failed.",
        code: error?.code || "COMMERCE_NOTIFICATION_FAILED",
      },
    };
  }
}

export default {
  notifyOrderPaid,
  notifyOrderRefunded,
  notifySafely,
};
