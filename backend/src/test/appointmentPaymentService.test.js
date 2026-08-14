import assert from "node:assert/strict";
import test from "node:test";

import Payment from "../features/commerce/Payment.js";
import {
  createAppointmentCheckoutPayment,
} from "../providers/paymentProvider.js";
import {
  confirmDemoAppointmentPayment,
  createAppointmentCheckout,
  failAppointmentPayment,
  settleAppointmentPayment,
} from "../features/appointments/appointmentPaymentService.js";
import {
  notifyAppointmentPaymentReceived,
} from "../features/appointments/appointmentPaymentNotificationService.js";
import appointmentManagementRoutes from "../features/appointments/appointmentManagementRoutes.js";

test("payment provider exposes appointment Checkout Sessions", () => {
  assert.equal(typeof createAppointmentCheckoutPayment, "function");
});

test("appointment payment service exposes checkout and reconciliation lifecycle", () => {
  assert.equal(typeof createAppointmentCheckout, "function");
  assert.equal(typeof settleAppointmentPayment, "function");
  assert.equal(typeof failAppointmentPayment, "function");
  assert.equal(typeof confirmDemoAppointmentPayment, "function");
  assert.equal(typeof notifyAppointmentPaymentReceived, "function");
});

test("shared Payment model supports appointment deposit and balance purposes", () => {
  const purpose = Payment.schema.path("purpose");
  assert.ok(purpose.enumValues.includes("appointment_deposit"));
  assert.ok(purpose.enumValues.includes("appointment_balance"));
});

test("appointment management router contains payment endpoints", () => {
  const paths = appointmentManagementRoutes.stack
    .map((layer) => layer.route?.path)
    .filter(Boolean);

  assert.ok(paths.includes("/:id/payments/checkout"));
  assert.ok(paths.includes("/:id/payments/:paymentId/confirm-demo"));
});
