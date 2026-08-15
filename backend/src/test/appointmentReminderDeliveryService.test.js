import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverDueAppointmentReminders,
} from "../features/appointments/appointmentReminderDeliveryService.js";
import {
  getAppointmentReminderConfiguration,
  getAppointmentReminderJobStatus,
  runAppointmentReminderCycle,
  startAppointmentReminderJob,
  stopAppointmentReminderJob,
} from "../jobs/appointmentReminderJob.js";

test("appointment reminder delivery service exposes the omnichannel worker", () => {
  assert.equal(
    typeof deliverDueAppointmentReminders,
    "function"
  );
});

test("appointment reminder job exposes production lifecycle controls", () => {
  assert.equal(typeof runAppointmentReminderCycle, "function");
  assert.equal(typeof startAppointmentReminderJob, "function");
  assert.equal(typeof stopAppointmentReminderJob, "function");
  assert.equal(typeof getAppointmentReminderJobStatus, "function");
});

test("appointment reminder configuration is preference driven", () => {
  const configuration =
    getAppointmentReminderConfiguration({
      enabled: false,
      hoursBefore: 24,
      lookAheadHours: 48,
      intervalMs: 300000,
      runImmediately: false,
      unrefTimer: true,
    });

  assert.equal(configuration.hoursBefore, 24);
  assert.equal(configuration.lookAheadHours, 48);
  assert.equal(
    Object.hasOwn(configuration, "channel"),
    false
  );

  const status =
    getAppointmentReminderJobStatus();

  assert.equal(
    status.configuration.channel,
    "customer_preference"
  );
});
