import assert from "node:assert/strict";
import test from "node:test";

import appointmentManagementRoutes from "../features/appointments/appointmentManagementRoutes.js";
import {
  communicationHistory,
  sendReminderNow,
} from "../features/appointments/appointmentStaffCommunicationController.js";

test("staff appointment communication controller exposes reminder and history actions", () => {
  assert.equal(typeof sendReminderNow, "function");
  assert.equal(typeof communicationHistory, "function");
});

test("appointment management router includes communication controls", () => {
  const paths = appointmentManagementRoutes.stack
    .map((layer) => layer?.route?.path)
    .filter(Boolean);

  assert.ok(paths.includes("/:id/communications/reminder"));
  assert.ok(paths.includes("/:id/communications"));
  assert.ok(paths.includes("/:id/payments/checkout"));
});
