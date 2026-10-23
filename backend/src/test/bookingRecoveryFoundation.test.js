import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("abandoned booking recovery persists user-owned intent without client tenant authority", async () => {
  const [model, service] = await Promise.all([
    source("../models/AbandonedBookingIntent.js"),
    source("../features/bookingRecovery/bookingRecoveryService.js"),
  ]);

  assert.match(model, /user:[\s\S]*required: true/);
  assert.match(model, /communicationClassification:[\s\S]*default: "marketing"/);
  assert.match(model, /recoverableUntil/);
  assert.match(model, /appointment:/);
  assert.match(service, /customer\?\.business/);
  assert.doesNotMatch(service, /payload\.business/);
  assert.match(service, /markStaleBookingIntentsAbandoned/);
  assert.match(service, /emitPendingBookingRecoveryEvents/);
  assert.match(service, /type: "booking\.abandoned"/);
  assert.match(service, /type: "booking\.recovered"/);
});

test("booking recovery token is signed, expiring and not stored as plaintext", async () => {
  const token = await source(
    "../features/bookingRecovery/bookingRecoveryToken.js"
  );
  const model = await source("../models/AbandonedBookingIntent.js");

  assert.match(token, /createHmac\("sha256"/);
  assert.match(token, /timingSafeEqual/);
  assert.match(token, /BOOKING_RECOVERY_TOKEN_SECRET/);
  assert.match(token, /recoverableUntil/);
  assert.doesNotMatch(model, /tokenCiphertext|recoveryToken|plaintextToken/);
});

test("workflow engine provides consent-gated booking recovery action", async () => {
  const [actions, engine, policy, catalogue] = await Promise.all([
    source("../models/WorkflowAction.js"),
    source("../features/workflows/workflowEngineService.js"),
    source("../features/workflows/workflowCommunicationPolicy.js"),
    source("../features/integrationPlatform/domainEventCatalogue.js"),
  ]);

  assert.match(actions, /"booking_recovery\.enqueue"/);
  assert.match(engine, /processBookingRecoveryTick/);
  assert.match(engine, /bookingRecoveryUrl/);
  assert.match(engine, /assertWorkflowCommunicationAllowed/);
  assert.match(engine, /ScheduledCommunication\.create/);
  assert.match(policy, /marketingConsent/);
  assert.match(policy, /emailSuppressed/);
  assert.match(catalogue, /"booking\.abandoned"/);
  assert.match(catalogue, /"booking\.recovered"/);
});

test("customer booking UI restores and attributes without bypassing canonical appointment creation", async () => {
  const [routes, api, page] = await Promise.all([
    source("../routes/appointmentRoutes.js"),
    source("../../frontend/src/Services/appointmentApi.js"),
    source("../../frontend/src/pages/Booking.jsx"),
  ]);

  assert.match(routes, /"\/recovery"/);
  assert.match(api, /resumeBookingRecoveryIntent/);
  assert.match(api, /attributeBookingRecoveryAppointment/);
  assert.match(page, /createAppointment\(/);
  assert.match(page, /attributeBookingRecoveryAppointment/);
  assert.match(page, /setSearchParams\(\{\}, \{ replace: true \}\)/);
  assert.match(page, /Unable to attribute recovered booking/);
});
