import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("sequence rescheduling atomically replaces provider and resource reservations", async () => {
  const service = await source(
    "../features/bookingSequences/sequenceRescheduleService.js"
  );

  const start = service.indexOf(
    "export async function rescheduleSequencedManagedAppointment"
  );
  assert.ok(start >= 0, "sequence reschedule service must be exported");

  const handler = service.slice(start);
  assert.match(handler, /databaseSession\.withTransaction/);
  assert.match(handler, /ProviderOccupancyReservation\.findOne/);
  assert.match(
    service,
    /assertProviderWindowsAvailable[\s\S]*excludeAppointmentId:\s*appointmentId/
  );
  assert.match(
    handler,
    /assertProviderWindowsAvailable\([\s\S]*appointment\._id[\s\S]*\)/
  );
  assert.match(handler, /ProviderOccupancyReservation\.deleteMany/);
  assert.match(handler, /BookingResourceReservation\.deleteMany/);
  assert.match(handler, /ProviderOccupancyReservation\.create/);
  assert.match(handler, /BookingResourceReservation\.create/);
  assert.match(handler, /recordReschedule/);
});

test("sequence reschedule endpoint uses the sequence-aware workflow", async () => {
  const controller = await source(
    "../features/appointments/sequenceBookingController.js"
  );
  const routes = await source(
    "../features/appointments/appointmentManagementRoutes.js"
  );

  assert.match(controller, /rescheduleSequencedManagedAppointment/);
  assert.match(controller, /export async function rescheduleSequencedAppointment/);
  assert.match(routes, /\/:id\/sequence-reschedule/);
  assert.match(routes, /appointmentLifecycleNotification\("rescheduled"\)/);
  assert.match(routes, /asyncHandler\(\s*rescheduleSequencedAppointment\s*\)/);
});
