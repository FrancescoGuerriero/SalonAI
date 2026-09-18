import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAppointmentCalendarEvent,
} from "../integrations/calendar/calendarEvent.js";
import {
  CalendarSyncService,
} from "../integrations/calendar/calendarSyncService.js";
import {
  IntegrationRegistry,
} from "../integrations/integrationRegistry.js";

function appointment(overrides = {}) {
  return {
    _id: "appointment-123",
    startsAt: "2026-09-21T09:00:00.000Z",
    endsAt: "2026-09-21T10:30:00.000Z",
    status: "confirmed",
    bookingSource: "website",
    customer: {
      _id: "customer-1",
      name: "Private Customer",
      email: "private@example.com",
      phone: "+440000000000",
    },
    stylist: {
      _id: "stylist-1",
      firstName: "Amara",
      lastName: "Okafor",
    },
    service: {
      _id: "service-1",
      name: "Cut and finish",
    },
    notes: "Sensitive appointment notes",
    internalNotes: "Never leave SalonAI",
    ...overrides,
  };
}

test("calendar event is private and omits customer PII by default", () => {
  const event =
    buildAppointmentCalendarEvent({
      appointment: appointment(),
    });

  assert.equal(
    event.summary,
    "SalonAI — Cut and finish"
  );
  assert.equal(event.visibility, "private");
  assert.equal(event.staff, "Amara Okafor");
  assert.equal(event.metadata.appointmentId, "appointment-123");
  assert.equal(event.metadata.stylistId, "stylist-1");
  assert.equal(event.metadata.serviceId, "service-1");

  const serialised = JSON.stringify(event);

  assert.equal(
    serialised.includes("Private Customer"),
    false
  );
  assert.equal(
    serialised.includes("private@example.com"),
    false
  );
  assert.equal(
    serialised.includes("+440000000000"),
    false
  );
  assert.equal(
    serialised.includes("Sensitive appointment notes"),
    false
  );
  assert.equal(
    serialised.includes("Never leave SalonAI"),
    false
  );
});

test("customer name is opt-in rather than silently exported", () => {
  const event =
    buildAppointmentCalendarEvent({
      appointment: appointment(),
      includeCustomerName: true,
    });

  assert.equal(
    event.summary,
    "SalonAI — Cut and finish — Private Customer"
  );
});

test("cancelled appointments produce cancelled calendar events", () => {
  const event =
    buildAppointmentCalendarEvent({
      appointment: appointment({
        status: "cancelled",
      }),
    });

  assert.equal(event.status, "cancelled");
});

test("calendar event rejects invalid appointment windows", () => {
  assert.throws(
    () =>
      buildAppointmentCalendarEvent({
        appointment: appointment({
          startsAt:
            "2026-09-21T10:30:00.000Z",
          endsAt:
            "2026-09-21T09:00:00.000Z",
        }),
      }),
    /end must be after/
  );
});

test("calendar sync uses a stable appointment idempotency key", async () => {
  const registry = new IntegrationRegistry();
  const calls = [];

  registry.register({
    id: "google-calendar",
    capabilities: ["calendar.write"],
    adapter: {
      async upsertEvent(payload) {
        calls.push(payload);

        return {
          providerEventId:
            "google-event-123",
          status: "synced",
        };
      },
    },
  });

  const service =
    new CalendarSyncService({
      registry,
    });

  const result =
    await service.syncAppointment({
      providerId: "google-calendar",
      calendarId: "primary",
      appointment: appointment(),
    });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].idempotencyKey,
    "appointment:appointment-123"
  );
  assert.equal(
    calls[0].calendarId,
    "primary"
  );
  assert.equal(
    result.providerEventId,
    "google-event-123"
  );
  assert.equal(
    result.sourceId,
    "appointment-123"
  );
});

test("calendar sync rejects non-calendar and read-only adapters", async () => {
  const registry = new IntegrationRegistry();

  registry.register({
    id: "stripe",
    capabilities: ["payments.checkout"],
    adapter: {
      async upsertEvent() {},
    },
  });

  registry.register({
    id: "google-calendar",
    capabilities: ["calendar.read"],
    adapter: {
      async upsertEvent() {},
    },
  });

  const service =
    new CalendarSyncService({
      registry,
    });

  await assert.rejects(
    service.syncAppointment({
      providerId: "stripe",
      calendarId: "primary",
      appointment: appointment(),
    }),
    /not a calendar provider/
  );

  await assert.rejects(
    service.syncAppointment({
      providerId: "google-calendar",
      calendarId: "primary",
      appointment: appointment(),
    }),
    /does not allow calendar.write/
  );
});
