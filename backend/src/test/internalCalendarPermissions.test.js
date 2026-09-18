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


test("calendar customer lookup is scoped to appointment mutation authority and minimal fields", async () => {
  const routes =
    await readFile(
      new URL(
        "../features/appointments/appointmentManagementRoutes.js",
        import.meta.url
      ),
      "utf8"
    );
  const service =
    await readFile(
      new URL(
        "../features/appointments/appointmentManagementService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /"\/customers"[\s\S]*?"appointment:create"[\s\S]*?"appointment:update"/
  );
  assert.match(
    service,
    /async function searchAppointmentCustomers/
  );
  assert.match(
    service,
    /"firstName lastName preferredName email phone status"/
  );
  assert.equal(
    service.includes(
      '"hairProfile"'
    ),
    false
  );
});

test("internal calendar UI uses management APIs and permission-aware controls", async () => {
  const calendar =
    await readFile(
      new URL(
        "../../../frontend/src/components/calendar/AppointmentCalendar.jsx",
        import.meta.url
      ),
      "utf8"
    );
  const editor =
    await readFile(
      new URL(
        "../../../frontend/src/components/calendar/AppointmentEditorDialog.jsx",
        import.meta.url
      ),
      "utf8"
    );
  const api =
    await readFile(
      new URL(
        "../../../frontend/src/Services/appointmentManagementApi.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    calendar,
    /appointmentManagementApi\.getCalendar/
  );
  assert.equal(
    calendar.includes(
      "getAppointments"
    ),
    false
  );
  assert.match(
    calendar,
    /"appointment:create"/
  );
  assert.match(
    calendar,
    /"appointment:update"/
  );
  assert.match(
    calendar,
    /"appointment:cancel"/
  );
  assert.match(
    editor,
    /appointmentManagementApi\.create/
  );
  assert.match(
    editor,
    /appointmentManagementApi\.reschedule/
  );
  assert.match(
    editor,
    /appointmentManagementApi\.updateStatus/
  );
  assert.match(
    api,
    /\/customers/
  );
});
