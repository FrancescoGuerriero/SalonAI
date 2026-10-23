import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import Invoice from "./Invoice.js";
import Order from "./Order.js";
import Payment from "./Payment.js";

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function actorId(actor) {
  const value = actor?._id || actor?.id || actor || null;
  return mongoose.isValidObjectId(value) ? value : undefined;
}

function objectId(value, label) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`Invalid ${label} ID.`, 400);
  }
  return value;
}

function lineTotal(quantity, unitPrice) {
  return money(Number(quantity || 0) * Number(unitPrice || 0));
}

function appointmentLines(appointment) {
  const amount = money(
    appointment.finalPrice ??
      appointment.totalPrice ??
      appointment.service?.price ??
      0
  );

  return [
    {
      kind: "service",
      referenceId: appointment.service?._id || appointment.service || undefined,
      description:
        String(appointment.service?.name || appointment.serviceName || "Salon appointment").trim(),
      quantity: 1,
      unitPrice: amount,
      lineTotal: amount,
    },
  ];
}

function orderLines(order) {
  return (order.items || []).map((item) => {
    const quantity = Number(item.quantity || 1);
    const unitPrice = money(item.unitPrice);
    return {
      kind:
        item.itemType === "product"
          ? "product"
          : item.itemType === "service_package"
            ? "service_package"
            : item.itemType === "appointment"
              ? "service"
              : "other",
      referenceId:
        item.product || item.servicePackage || item.appointment || undefined,
      description: String(item.name || item.sku || "Commerce item").trim(),
      quantity,
      unitPrice,
      lineTotal: money(item.lineTotal ?? lineTotal(quantity, unitPrice)),
    };
  });
}

async function paymentSummary(filter) {
  const payments = await Payment.find(filter).lean();

  let amountPaid = 0;
  let amountRefunded = 0;
  let paidAt = null;
  let refundedAt = null;

  for (const payment of payments) {
    if (["paid", "partially_refunded", "refunded"].includes(payment.status)) {
      amountPaid += Number(payment.amount || 0);
      if (payment.paidAt && (!paidAt || new Date(payment.paidAt) > paidAt)) {
        paidAt = new Date(payment.paidAt);
      }
    }

    amountRefunded += Number(payment.refundedAmount || 0);
    if (payment.refundedAt && (!refundedAt || new Date(payment.refundedAt) > refundedAt)) {
      refundedAt = new Date(payment.refundedAt);
    }
  }

  return {
    amountPaid: money(amountPaid),
    amountRefunded: money(amountRefunded),
    paidAt,
    refundedAt,
  };
}

function financialStatus({
  total,
  amountPaid,
  amountRefunded,
  cancelled = false,
}) {
  if (cancelled && amountPaid <= 0) return "void";
  if (amountRefunded > 0 && amountPaid > 0 && amountRefunded >= amountPaid) {
    return "refunded";
  }
  if (amountRefunded > 0) return "partially_refunded";
  if (amountPaid >= total && total > 0) return "paid";
  if (amountPaid > 0) return "partially_paid";
  return "issued";
}

async function persistAppointmentCompatibilityNumber(appointment, invoice) {
  if (appointment.invoiceNumber === invoice.invoiceNumber) return;
  appointment.invoiceNumber = invoice.invoiceNumber;
  await appointment.save();
}

export async function reconcileAppointmentInvoice(invoice, appointment = null) {
  const source =
    appointment ||
    assertFound(
      await Appointment.findById(invoice.appointment)
        .populate("customer", "firstName lastName preferredName email")
        .populate("service", "name price duration"),
      "Appointment not found."
    );

  const total = money(
    source.finalPrice ?? source.totalPrice ?? source.service?.price ?? invoice.total
  );
  const payments = await paymentSummary({ appointment: source._id });
  const amountPaid = money(Math.max(Number(source.amountPaid || 0), payments.amountPaid));
  const amountRefunded = payments.amountRefunded;
  const balanceDue = money(Math.max(0, total - amountPaid));
  const status = financialStatus({
    total,
    amountPaid,
    amountRefunded,
    cancelled: source.status === "cancelled",
  });

  invoice.business = source.business || invoice.business;
  invoice.location = source.location || invoice.location;
  invoice.customer = source.customer?._id || source.customer || invoice.customer;
  invoice.lines = appointmentLines(source);
  invoice.subtotal = total;
  invoice.total = total;
  invoice.amountPaid = amountPaid;
  invoice.amountRefunded = amountRefunded;
  invoice.balanceDue = balanceDue;
  invoice.status = status;
  invoice.paidAt = status === "paid" ? payments.paidAt || invoice.paidAt || new Date() : payments.paidAt;
  invoice.refundedAt = ["partially_refunded", "refunded"].includes(status)
    ? payments.refundedAt || invoice.refundedAt || new Date()
    : payments.refundedAt;
  invoice.voidedAt = status === "void" ? invoice.voidedAt || new Date() : null;

  await invoice.save();
  await persistAppointmentCompatibilityNumber(source, invoice);
  return invoice;
}

export async function issueAppointmentInvoice(appointmentId, actor = null) {
  objectId(appointmentId, "appointment");

  const appointment = assertFound(
    await Appointment.findById(appointmentId)
      .populate("customer", "firstName lastName preferredName email")
      .populate("service", "name price duration"),
    "Appointment not found."
  );

  let invoice = await Invoice.findOne({ appointment: appointment._id });
  if (!invoice) {
    const total = money(
      appointment.finalPrice ?? appointment.totalPrice ?? appointment.service?.price ?? 0
    );

    invoice = await Invoice.create({
      business: appointment.business || undefined,
      location: appointment.location || undefined,
      customer: appointment.customer?._id || appointment.customer || undefined,
      appointment: appointment._id,
      sourceType: "appointment",
      currency: "GBP",
      lines: appointmentLines(appointment),
      subtotal: total,
      total,
      balanceDue: total,
      issuedBy: actorId(actor),
      metadata: {
        bookingSource: appointment.bookingSource || "",
      },
    });
  }

  return reconcileAppointmentInvoice(invoice, appointment);
}

export async function getAppointmentInvoice(appointmentId) {
  objectId(appointmentId, "appointment");
  const invoice = assertFound(
    await Invoice.findOne({ appointment: appointmentId }),
    "Invoice not found."
  );
  return reconcileAppointmentInvoice(invoice);
}

export async function reconcileOrderInvoice(invoice, order = null) {
  const source =
    order ||
    assertFound(await Order.findById(invoice.order), "Order not found.");

  const total = money(source.total);
  const payments = await paymentSummary({ order: source._id });
  const amountPaid = payments.amountPaid;
  const amountRefunded = payments.amountRefunded;
  const balanceDue = money(Math.max(0, total - amountPaid));
  const status = financialStatus({
    total,
    amountPaid,
    amountRefunded,
    cancelled: source.status === "cancelled",
  });

  invoice.customer = source.customer || invoice.customer;
  invoice.lines = orderLines(source);
  invoice.subtotal = money(source.subtotal ?? total);
  invoice.total = total;
  invoice.amountPaid = amountPaid;
  invoice.amountRefunded = amountRefunded;
  invoice.balanceDue = balanceDue;
  invoice.status = status;
  invoice.paidAt = status === "paid" ? payments.paidAt || source.paidAt || invoice.paidAt || new Date() : payments.paidAt || source.paidAt;
  invoice.refundedAt = ["partially_refunded", "refunded"].includes(status)
    ? payments.refundedAt || invoice.refundedAt || new Date()
    : payments.refundedAt;
  invoice.voidedAt = status === "void" ? invoice.voidedAt || new Date() : null;

  await invoice.save();
  return invoice;
}

export async function issueOrderInvoice(orderId, actor = null) {
  objectId(orderId, "order");
  const order = assertFound(await Order.findById(orderId), "Order not found.");

  let invoice = await Invoice.findOne({ order: order._id });
  if (!invoice) {
    invoice = await Invoice.create({
      customer: order.customer || undefined,
      order: order._id,
      sourceType: "order",
      currency: order.currency || "GBP",
      lines: orderLines(order),
      subtotal: money(order.subtotal ?? order.total),
      total: money(order.total),
      balanceDue: money(order.total),
      issuedBy: actorId(actor),
      metadata: {
        orderNumber: order.orderNumber || "",
      },
    });
  }

  return reconcileOrderInvoice(invoice, order);
}

export async function getOrderInvoice(orderId) {
  objectId(orderId, "order");
  const invoice = assertFound(
    await Invoice.findOne({ order: orderId }),
    "Invoice not found."
  );
  return reconcileOrderInvoice(invoice);
}

export function invoicePublicView(invoice) {
  const value = typeof invoice?.toObject === "function" ? invoice.toObject() : invoice;

  return {
    id: value?._id,
    invoiceNumber: value?.invoiceNumber,
    sourceType: value?.sourceType,
    appointment: value?.appointment,
    order: value?.order,
    customer: value?.customer,
    currency: value?.currency,
    lines: value?.lines || [],
    subtotal: money(value?.subtotal),
    total: money(value?.total),
    amountPaid: money(value?.amountPaid),
    amountRefunded: money(value?.amountRefunded),
    balanceDue: money(value?.balanceDue),
    status: value?.status,
    issuedAt: value?.issuedAt,
    paidAt: value?.paidAt,
    refundedAt: value?.refundedAt,
    voidedAt: value?.voidedAt,
  };
}

export default {
  getAppointmentInvoice,
  getOrderInvoice,
  invoicePublicView,
  issueAppointmentInvoice,
  issueOrderInvoice,
  reconcileAppointmentInvoice,
  reconcileOrderInvoice,
};
