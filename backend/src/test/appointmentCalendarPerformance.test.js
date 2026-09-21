import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("calendar retrieval uses a lightweight projection without appointment audit-history populations", async () => {
  const source = await readFile(
    new URL("../features/appointments/appointmentManagementService.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /const CALENDAR_APPOINTMENT_FIELDS/);
  assert.match(source, /const CALENDAR_POPULATE_OPTIONS/);

  const start = source.indexOf("async function calendarAppointments");
  const end = source.indexOf("async function getAppointmentManagementSummary", start);
  const calendarSource = source.slice(start, end);

  assert.match(calendarSource, /\.select\(\s*CALENDAR_APPOINTMENT_FIELDS\s*\)/);
  assert.match(calendarSource, /\.populate\(\s*CALENDAR_POPULATE_OPTIONS\s*\)/);
  assert.doesNotMatch(calendarSource, /APPOINTMENT_POPULATE_OPTIONS/);

  for (const path of [
    "createdBy",
    "updatedBy",
    "statusHistory.changedBy",
    "rescheduleHistory.changedBy",
    "rescheduleHistory.previousStylist",
    "rescheduleHistory.newStylist",
  ]) {
    assert.equal(calendarSource.includes(path), false, path + " must not be populated by the calendar query.");
  }
});

test("calendar optimisation preserves the existing maximum result limit", async () => {
  const source = await readFile(
    new URL("../features/appointments/appointmentManagementService.js", import.meta.url),
    "utf8"
  );

  const start = source.indexOf("async function calendarAppointments");
  const end = source.indexOf("async function getAppointmentManagementSummary", start);
  const calendarSource = source.slice(start, end);

  assert.match(calendarSource, /maximum:\s*5000/);
});
