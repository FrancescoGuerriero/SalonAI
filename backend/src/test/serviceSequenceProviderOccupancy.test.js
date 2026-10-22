import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("sequence booking persists provider-only occupancy windows", async () => {
  const plan = await source(
    "../features/bookingSequences/sequenceReservationPlan.js"
  );
  const booking = await source(
    "../features/bookingSequences/sequencedAppointmentService.js"
  );

  assert.match(plan, /filter\(\(segment\) => segment\.providerRequired\)/);
  assert.match(plan, /providerWindows:\s*Object\.freeze\(providerWindows\)/);
  assert.match(booking, /providerWindows:\s*plan\.providerWindows/);
  assert.match(booking, /ProviderOccupancyReservation\.create\(/);
});

test("canonical conflict detection uses provider occupancy when present", async () => {
  const service = await source(
    "../features/appointments/appointmentManagementService.js"
  );

  assert.match(service, /ProviderOccupancyReservation/);
  assert.match(service, /providerReservationsForAppointments/);
  assert.match(service, /providerWindows\?\.length/);
  assert.match(service, /normaliseProviderWindows\(payload, window\)/);
  assert.match(service, /for \(const providerWindow of providerWindows\)/);
});

test("sequence resource reservation mapping uses reservation fields", async () => {
  const booking = await source(
    "../features/bookingSequences/sequencedAppointmentService.js"
  );

  assert.match(
    booking,
    /resourceKey\(\s*reservation\.kind,\s*reservation\.resourceKey\s*\)/
  );
  assert.match(booking, /segmentOrder:\s*reservation\.segmentOrder/);
  assert.match(booking, /segmentType:\s*reservation\.segmentType/);
  assert.doesNotMatch(booking, /\bresourcd\b/);
});
