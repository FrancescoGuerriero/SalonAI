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

test("group booking aggregate links canonical appointments instead of duplicating booking authority", async () => {
  const model = await source("../features/groupBookings/GroupBooking.js");

  assert.match(model, /appointment:[\s\S]*?ref: "Appointment"/);
  assert.match(model, /customer:[\s\S]*?ref: "Customer"/);
  assert.doesNotMatch(model, /service:[\s\S]*?ref: "Service"/);
  assert.doesNotMatch(model, /stylist:[\s\S]*?ref: "Stylist"/);
  assert.doesNotMatch(model, /status:[\s\S]*?enum/);
});

test("group creation is atomic, sequential and delegates every participant to canonical appointment creation", async () => {
  const service = await source("../features/groupBookings/groupBookingService.js");
  const start = service.indexOf("export async function createGroupBooking");
  const end = service.indexOf("export async function addGroupParticipant", start);
  const creation = service.slice(start, end);

  assert.match(creation, /session\.withTransaction/);
  assert.match(creation, /for \(const participant of participants\)/);
  assert.match(creation, /createManagedAppointment\(/);
  assert.match(creation, /bookingSource: "management"/);
  assert.match(creation, /returnPopulated: false/);
  assert.doesNotMatch(creation, /Promise\.all/);
  assert.doesNotMatch(creation, /Appointment\.create\(/);
});

test("group participant changes reuse canonical reschedule and status workflows", async () => {
  const service = await source("../features/groupBookings/groupBookingService.js");

  assert.match(service, /rescheduleGroupParticipant[\s\S]*?rescheduleAppointment\(/);
  assert.match(service, /changeGroupParticipantStatus[\s\S]*?changeAppointmentStatus\(/);
  assert.match(service, /changeGroupStatus[\s\S]*?for \(const participant of group\.participants\)/);
  assert.match(service, /partial-safe/);
});

test("group booking routes reuse appointment permissions and do not invent group permission vocabulary", async () => {
  const routes = await source("../features/groupBookings/groupBookingRoutes.js");

  assert.match(routes, /"appointment:read"/);
  assert.match(routes, /"appointment:create"/);
  assert.match(routes, /"appointment:update"/);
  assert.match(routes, /"appointment:cancel"/);
  assert.doesNotMatch(routes, /group-booking:[a-z]+/);
});
