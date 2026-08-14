import assert from "node:assert/strict";
import test from "node:test";

import {
  notifyAppointmentCancelled,
  notifyAppointmentConfirmed,
  notifyAppointmentPaymentFailed,
  notifyAppointmentPaymentRequest,
  notifyAppointmentReminder,
  notifyAppointmentRescheduled,
  notifySafely,
} from "../features/appointments/appointmentNotificationService.js";

test("appointment notification service exposes confirmation and schedule events", () => {
  assert.equal(typeof notifyAppointmentConfirmed, "function");
  assert.equal(typeof notifyAppointmentRescheduled, "function");
  assert.equal(typeof notifyAppointmentCancelled, "function");
  assert.equal(typeof notifyAppointmentReminder, "function");
});

test("appointment notification service exposes payment communication events", () => {
  assert.equal(typeof notifyAppointmentPaymentRequest, "function");
  assert.equal(typeof notifyAppointmentPaymentFailed, "function");
  assert.equal(typeof notifySafely, "function");
});

test("appointment payment request rejects missing appointment without provider work", async () => {
  const result = await notifyAppointmentPaymentRequest(
    "507f1f77bcf86cd799439011",
    {
      checkoutUrl: "https://example.com/pay/test",
      amount: 25,
    }
  );

  assert.equal(result.success, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "appointment_not_found");
});
