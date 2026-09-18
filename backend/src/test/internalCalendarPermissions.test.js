import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("appointment management routes enforce delegated calendar permissions", async () => {
  const source =
    await readFile(
      new URL(
        "../features/appointments/appointmentManagementRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /router\.post\(\s*"\/"[\s\S]*?"appointment:create"/
  );
  assert.match(
    source,
    /"\/calendar"[\s\S]*?"appointment:read"/
  );
  assert.match(
    source,
    /"\/:id\/reschedule"[\s\S]*?"appointment:update"/
  );
  assert.match(
    source,
    /requestedStatus === "cancelled"[\s\S]*?"appointment:cancel"/
  );
  assert.match(
    source,
    /requestedStatus === "cancelled"[\s\S]*?"appointment:update"/
  );
});

test("staff appointment creation uses management source and canonical conflict checks", async () => {
  const source =
    await readFile(
      new URL(
        "../features/appointments/appointmentManagementService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /async function createManagedAppointment/
  );
  assert.match(
    source,
    /Customer\.findById/
  );
  assert.match(
    source,
    /assertAppointmentWithinStaffAvailability/
  );
  assert.match(
    source,
    /findConflict\(/
  );
  assert.match(
    source,
    /bookingSource:\s*"management"/
  );
  assert.match(
    source,
    /createdBy:\s*actorId/
  );
});
