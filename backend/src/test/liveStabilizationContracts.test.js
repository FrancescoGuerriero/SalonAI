import assert from "node:assert/strict";
import test from "node:test";

import authRoutes from "../routes/authRoutes.js";
import customerExperienceRoutes from "../features/customerExperience/customerExperienceRoutes.js";
import CustomerExperienceProfile from "../features/customerExperience/CustomerExperienceProfile.js";
import {
  addExpandedConsultation,
} from "../features/customerExperience/customerConsultationController.js";
import {
  emailDeliveryStatus,
  sendEmail,
} from "../providers/emailProvider.js";
import {
  rateLimitKey,
} from "../middleware/securityMiddleware.js";

function routePaths(router) {
  return router.stack
    .map((layer) => layer.route?.path)
    .filter(Boolean);
}

test("auth router exposes registration verification lifecycle", () => {
  const paths = routePaths(authRoutes);

  assert.ok(paths.includes("/register"));
  assert.ok(paths.includes("/verify-email"));
  assert.ok(paths.includes("/resend-verification"));
  assert.ok(paths.includes("/login"));
});

test("customer experience router uses expanded consultation endpoint", () => {
  const paths = routePaths(customerExperienceRoutes);

  assert.ok(paths.includes("/me/consultations"));
  assert.equal(typeof addExpandedConsultation, "function");
});

test("consultation schema persists professional consultation fields", () => {
  const consultationPath = CustomerExperienceProfile.schema.path("consultations");
  const subSchema = consultationPath.schema;

  for (const field of [
    "texturePattern",
    "density",
    "strandThickness",
    "porosity",
    "hairCondition",
    "naturalColour",
    "colourHistory",
    "bleachHistory",
    "washFrequency",
    "heatStylingFrequency",
    "homeCareRoutine",
    "concerns",
    "maintenancePreference",
    "budgetRange",
    "patchTestRequired",
    "safetyNotes",
  ]) {
    assert.ok(subSchema.path(field), `missing consultation field ${field}`);
  }
});

test("rate-limit key generator returns normalized client keys", () => {
  const key = rateLimitKey({
    headers: {},
    ip: "2001:db8:85a3::8a2e:370:7334",
    socket: {},
  });

  assert.equal(typeof key, "string");
  assert.ok(key.length > 0);
});

test("email provider is fail-closed for production-like disabled delivery", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnabled = process.env.EMAIL_DELIVERY_ENABLED;
  const originalMode = process.env.EMAIL_PROVIDER_MODE;

  try {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_DELIVERY_ENABLED = "false";
    process.env.EMAIL_PROVIDER_MODE = "mock";

    assert.deepEqual(emailDeliveryStatus(), {
      mode: "mock",
      enabled: false,
      live: false,
    });

    await assert.rejects(
      sendEmail({
        to: "customer@example.com",
        subject: "Test",
        message: "Test",
      }),
      /disabled in production/i
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.EMAIL_DELIVERY_ENABLED = originalEnabled;
    process.env.EMAIL_PROVIDER_MODE = originalMode;
  }
});
