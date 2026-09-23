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
  assert.match(model, /organiser:[\s\S]*?ref: "Customer"/);
  assert.doesNotMatch(model, /service:[\s\S]*?ref: "Service"/);
  assert.doesNotMatch(model, /stylist:[\s\S]*?ref: "Stylist"/);
  assert.doesNotMatch(model, /status:[\s\S]*?enum/);
  assert.match(model, /\{ "participants\.appointment": 1 \}, \{ unique: true \}/);
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
  assert.match(creation, /status: "pending"/);
  assert.doesNotMatch(creation, /participant\.duration/);
  assert.doesNotMatch(creation, /participant\.endsAt/);
  assert.doesNotMatch(creation, /Promise\.all/);
  assert.doesNotMatch(creation, /Appointment\.create\(/);
  assert.doesNotMatch(creation, /participantLinks\.push\(\{[\s\S]*?customer,/);
});

test("group participant changes reuse canonical reschedule and status workflows", async () => {
  const service = await source("../features/groupBookings/groupBookingService.js");

  assert.match(service, /rescheduleGroupParticipant[\s\S]*?rescheduleAppointment\(/);
  assert.match(service, /changeGroupParticipantStatus[\s\S]*?changeAppointmentStatus\(/);
  assert.match(service, /changeGroupStatus[\s\S]*?for \(const participant of group\.participants\)/);
  assert.match(service, /partial-safe/);
  assert.ok((service.match(/\["cancelled", "no_show"\]\.includes\(status\)/g) || []).length >= 2);
});

test("group booking routes reuse appointment permissions and do not invent group permission vocabulary", async () => {
  const routes = await source("../features/groupBookings/groupBookingRoutes.js");

  assert.match(routes, /"appointment:read"/);
  assert.match(routes, /"appointment:create"/);
  assert.match(routes, /"appointment:update"/);
  assert.match(routes, /"appointment:cancel"/);
  assert.doesNotMatch(routes, /group-booking:[a-z]+/);
});


test("group booking lifecycle preserves canonical notification behaviour after booking mutations", async () => {
  const service = await source("../features/groupBookings/groupBookingService.js");

  assert.match(service, /notifyAppointmentConfirmed/);
  assert.match(service, /notifyAppointmentRescheduled/);
  assert.match(service, /notifyAppointmentCancelled/);
  assert.match(service, /notifySafely/);
  assert.match(service, /source: "group_booking"/);

  const creationStart = service.indexOf("export async function createGroupBooking");
  const creationEnd = service.indexOf("export async function addGroupParticipant", creationStart);
  const creation = service.slice(creationStart, creationEnd);
  const transactionEnd = creation.indexOf("await session.endSession");
  const notification = creation.indexOf("notifyCreatedAppointment");

  assert.ok(transactionEnd >= 0 && notification > transactionEnd);
});

test("future feature router mounts group bookings behind its governed feature control", async () => {
  const routes = await source("../features/futureFeatureRoutes.js");

  assert.match(
    routes,
    /"\/group-bookings"[\s\S]*?requireFeature\("group-bookings"\)[\s\S]*?groupBookingRoutes/
  );
});


test("group participant aggregate stores only the canonical appointment link and presentation label", async () => {
  const service = await source("../features/groupBookings/groupBookingService.js");
  const addStart = service.indexOf("export async function addGroupParticipant");
  const addEnd = service.indexOf("async function participantAppointment", addStart);
  const add = service.slice(addStart, addEnd);

  assert.match(add, /group\.participants\.push\(\{[\s\S]*?appointment: appointment\._id/);
  assert.doesNotMatch(add, /group\.participants\.push\(\{[\s\S]*?customer,/);
});


test("group booking database identifiers are normalized before Mongoose queries", async () => {
  const service = await source("../features/groupBookings/groupBookingService.js");

  assert.match(service, /return new mongoose\.Types\.ObjectId\(normalized\)/);
  assert.match(service, /Customer\.findById\(safeCustomerId\)/);
  assert.match(service, /GroupBooking\.findById\(safeGroupBookingId\)/);
  assert.match(service, /group\.participants\.id\(safeParticipantId\)/);
});
