import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("marketing attribution uses projected appointment data without customer population", async () => {
  const source = await readFile(
    new URL("../features/marketingAttribution/marketingAttributionService.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /\.select\(\s*"customer service status startsAt appointmentDate appointmentTime finalPrice totalPrice price bookingSource utmSource marketingSource acquisitionSource source"\s*\)/);
  assert.doesNotMatch(source, /\.populate\(\s*"customer"/);
  assert.match(source, /\.populate\(\s*"service",\s*"price"\s*\)/);
});

test("executive command counts upcoming appointments and projects analytics inputs", async () => {
  const source = await readFile(
    new URL("../features/executiveCommand/executiveCommandService.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /Appointment\.countDocuments\(\{/);
  assert.match(source, /upcomingAppointments:\s*upcomingCount/);
  assert.doesNotMatch(source, /upcoming\.length/);
  assert.doesNotMatch(source, /\.populate\(\s*"customer"/);
  assert.match(source, /"quantityOnHand reorderPoint"/);
  assert.match(source, /"rating sentiment"/);
  assert.match(source, /"status recipients"/);
});
