import assert from "node:assert/strict";
import test from "node:test";

import appointmentRoutes from "../routes/appointmentRoutes.js";
import customerExperienceRoutes from "../features/customerExperience/customerExperienceRoutes.js";
import {
  getCommunicationPreferences,
  updateCommunicationPreferences,
} from "../features/customerExperience/customerCommunicationPreferencesController.js";
import {
  createAppointmentPaymentCheckout,
} from "../controllers/appointmentController.js";

function routePaths(router) {
  return router.stack
    .map((layer) => layer.route?.path)
    .filter(Boolean);
}

test("customer appointment router exposes owned payment checkout", () => {
  assert.equal(typeof createAppointmentPaymentCheckout, "function");
  assert.ok(
    routePaths(appointmentRoutes).includes("/:id/payments/checkout")
  );
});

test("customer experience router exposes communication preferences", () => {
  const paths = routePaths(customerExperienceRoutes);
  assert.ok(paths.includes("/me/communications"));
  assert.equal(typeof getCommunicationPreferences, "function");
  assert.equal(typeof updateCommunicationPreferences, "function");
});
