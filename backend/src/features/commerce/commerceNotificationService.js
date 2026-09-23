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

function hasOrderItemType(
  order,
  itemType
) {
  return (
    Array.isArray(order?.items) &&
    order.items.some(
      (item) =>
        String(
          item?.itemType ||
            "product"
        ) === itemType
    )
  );
}

/*
 * Paid orders can contain physical products, appointment balances and service
 * packages in the same checkout. Keep customer messaging aligned with what was
 * actually purchased instead of treating every non-delivery order as a salon
 * collection.
 */
export function paidOrderFulfilmentCopy(
  order = {}
) {
  const hasProducts =
    hasOrderItemType(
      order,
      "product"
    );
  const hasAppointments =
    hasOrderItemType(
      order,
      "appointment"
    );
  const hasPackages =
    hasOrderItemType(
      order,
      "service_package"
    );
  const physicalFulfilment =
    order.fulfilmentType ===
    "delivery"
      ? "delivery"
      : "collection";

  const sentences = [];
  const templateParts = [];

  if (hasProducts) {
    sentences.push(
      `Your product order is now being prepared for ${physicalFulfilment}.`
    );
    templateParts.push(
      physicalFulfilment
    );
  }

  if (hasPackages) {
    sentences.push(
      "Your service-package credits are now available in your account."
    );
    templateParts.push(
      "digital service credit activation"
    );
  }

  if (hasAppointments) {
    sentences.push(
      "Your appointment payment has been recorded."
    );
    templateParts.push(
      "appointment payment confirmation"
    );
  }

  if (
    sentences.length === 0
  ) {
    sentences.push(
      "Your payment has been recorded."
    );
    templateParts.push(
      "payment confirmation"
    );
  }

  return {
    sentence:
      sentences.join(" "),
    templateFulfilment:
      templateParts.join(
        " and "
      ),
  };
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
  const fulfilment =
    paidOrderFulfilmentCopy(
      order
    );
  const body = `Hi ${name}, payment of \u00A3${amount} for SalonAI order ${order.orderNumber} has been received. ${fulfilment.sentence}`;

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
    html: `<p>Hi ${name},</p><p>Payment of <strong>\u00A3${amount}</strong> for order <strong>${order.orderNumber}</strong> has been received.</p><p>${fulfilment.sentence}</p>`,
    whatsapp: {
      body,
      template: resolveWhatsAppEventTemplate("order_paid"),
      contentVariables: {
        1: name,
        2: order.orderNumber,
        3: `\u00A3${amount}`,
        4:
          fulfilment.templateFulfilment,
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
  const body = `Hi ${name}, a ${refundLabel} of \u00A3${refundedAmount} has been recorded for SalonAI order ${order.orderNumber}. Your bank or card provider may take additional time to display the funds.`;
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
    html: `<p>Hi ${name},</p><p>A ${refundLabel} of <strong>\u00A3${refundedAmount}</strong> has been recorded for order <strong>${order.orderNumber}</strong>.</p><p>Your bank or card provider may take additional time to display the funds.</p>`,
    whatsapp: {
      body,
      template: resolveWhatsAppEventTemplate("refund"),
      contentVariables: {
        1: name,
        2: order.orderNumber,
        3: `\u00A3${refundedAmount}`,
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
