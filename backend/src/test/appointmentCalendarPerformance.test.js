import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CORE_URL = new URL(
  "../features/appointments/appointmentManagementCore.js",
  import.meta.url
);

async function appointmentManagementCoreSource() {
  return readFile(CORE_URL, "utf8");
}

function calendarFunctionSource(source) {
  const start = source.indexOf("async function calendarAppointments");
  const end = source.indexOf("async function getAppointmentManagementSummary", start);

  assert.notEqual(start, -1, "calendarAppointments must remain in appointmentManagementCore.js");
  assert.notEqual(end, -1, "getAppointmentManagementSummary must follow the calendar implementation");

  return source.slice(start, end);
}

test("calendar retrieval uses a lightweight projection without appointment audit-history populations", async () => {
  const source = await appointmentManagementCoreSource();

  assert.match(source, /const CALENDAR_APPOINTMENT_FIELDS/);
  assert.match(source, /const CALENDAR_POPULATE_OPTIONS/);

  const calendarSource = calendarFunctionSource(source);

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
  const source = await appointmentManagementCoreSource();
  const calendarSource = calendarFunctionSource(source);

  assert.match(calendarSource, /maximum:\s*5000/);
});
