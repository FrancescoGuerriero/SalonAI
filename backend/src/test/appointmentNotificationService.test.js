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
