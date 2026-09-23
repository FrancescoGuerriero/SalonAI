import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function source(relativePath) {
  return fs.readFile(
    path.resolve(process.cwd(), "src/test", relativePath),
    "utf8"
  );
}

test("service trials preserve permanent catalogue pricing and create canonical appointments from snapshots", async () => {
  const service = await source("../features/serviceTrials/serviceTrialService.js");
  const start = service.indexOf("export async function bookServiceTrial");
  const end = service.indexOf("const BOOKING_POPULATE", start);
  const booking = service.slice(start, end);

  assert.match(booking, /session\.withTransaction/);
  assert.match(booking, /createManagedAppointment\(/);
  assert.match(booking, /duration: definition\.trialDuration/);
  assert.match(booking, /totalPrice: definition\.trialPrice/);
  assert.match(booking, /priceSnapshot: definition\.trialPrice/);
  assert.match(booking, /durationSnapshot: definition\.trialDuration/);
  assert.doesNotMatch(booking, /Service\.findByIdAndUpdate/);
  assert.doesNotMatch(booking, /Appointment\.create\(/);
});

test("trial eligibility uses one atomic customer ledger with an enforced unique key", async () => {
  const model = await source("../features/serviceTrials/ServiceTrialEligibility.js");
  const service = await source("../features/serviceTrials/serviceTrialService.js");

  assert.match(model, /\{ trial: 1, customer: 1 \}/);
  assert.match(model, /\{ unique: true \}/);
  assert.match(service, /bookingsClaimed: \{ \$lt: definition\.maxUsesPerCustomer \}/);
  assert.match(service, /\$inc: \{ bookingsClaimed: 1 \}/);
  assert.match(service, /Number\(error\?\.code\) === 11000/);
  assert.match(service, /cooldownDays/);
});

test("trial conversion requires a later non-trial canonical appointment for the same customer and service", async () => {
  const service = await source("../features/serviceTrials/serviceTrialService.js");
  const start = service.indexOf("export async function recordServiceTrialConversion");
  const conversion = service.slice(start);

  assert.match(conversion, /Appointment\.findById\(booking\.appointment\)/);
  assert.match(conversion, /Appointment\.findById\(convertedAppointmentId\)/);
  assert.match(conversion, /ServiceTrialBooking\.findOne/);
  assert.match(conversion, /String\(candidate\.customer\)/);
  assert.match(conversion, /String\(candidate\.service\)/);
  assert.match(conversion, /conversionWindowDaysSnapshot/);
  assert.match(conversion, /\["cancelled", "no_show"\]/);
});

test("trial routes reuse service and appointment permissions", async () => {
  const routes = await source("../features/serviceTrials/serviceTrialRoutes.js");

  assert.match(routes, /"service:update"/);
  assert.match(routes, /"appointment:read"/);
  assert.match(routes, /"appointment:create"/);
  assert.match(routes, /"appointment:update"/);
  assert.doesNotMatch(routes, /trial:[a-z]+/);
});
