import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  getProviderEvent,
} from "../integrations/calendar/calendarProviderEventApi.js";

function response(
  status,
  body = null
) {
  return {
    ok:
      status >= 200 &&
      status < 300,
    status,
    async json() {
      return body;
    },
  };
}

test("Google mapped-event read returns provider time and deletion state", async () => {
  const original =
    globalThis.fetch;

  globalThis.fetch =
    async () =>
      response(
        200,
        {
          id: "google-1",
          etag: "v2",
          status:
            "confirmed",
          updated:
            "2026-09-18T19:00:00Z",
          start: {
            dateTime:
              "2026-10-01T09:30:00+01:00",
          },
          end: {
            dateTime:
              "2026-10-01T10:30:00+01:00",
          },
        }
      );

  try {
    const event =
      await getProviderEvent({
        provider:
          "google",
        calendarId:
          "primary",
        providerEventId:
          "google-1",
        accessToken:
          "token",
      });

    assert.equal(
      event.deleted,
      false
    );
    assert.equal(
      event.start,
      "2026-10-01T09:30:00+01:00"
    );
    assert.equal(
      event.end,
      "2026-10-01T10:30:00+01:00"
    );
  } finally {
    globalThis.fetch =
      original;
  }
});

test("removed mapped provider events normalize to deletion without inventing new bookings", async () => {
  const original =
    globalThis.fetch;

  globalThis.fetch =
    async () =>
      response(
        404,
        {
          error: {
            message:
              "Not found",
          },
        }
      );

  try {
    for (const provider of [
      "google",
      "outlook",
    ]) {
      const event =
        await getProviderEvent({
          provider,
          calendarId:
            "calendar-1",
          providerEventId:
            "mapped-event",
          accessToken:
            "token",
        });

      assert.equal(
        event.deleted,
        true
      );
      assert.equal(
        event.providerEventId,
        "mapped-event"
      );
    }
  } finally {
    globalThis.fetch =
      original;
  }
});

test("Outlook mapped-event read requests UTC to make reconciliation deterministic", async () => {
  const original =
    globalThis.fetch;
  let headers;

  globalThis.fetch =
    async (
      _url,
      options
    ) => {
      headers =
        options.headers;

      return response(
        200,
        {
          id:
            "outlook-1",
          changeKey:
            "change-2",
          lastModifiedDateTime:
            "2026-09-18T19:00:00Z",
          start: {
            dateTime:
              "2026-10-01T08:30:00.0000000",
            timeZone:
              "UTC",
          },
          end: {
            dateTime:
              "2026-10-01T09:30:00.0000000",
            timeZone:
              "UTC",
          },
        }
      );
    };

  try {
    const event =
      await getProviderEvent({
        provider:
          "outlook",
        calendarId:
          "calendar-1",
        providerEventId:
          "outlook-1",
        accessToken:
          "token",
      });

    assert.equal(
      headers.Prefer,
      'outlook.timezone="UTC"'
    );
    assert.match(
      event.start,
      /Z$/
    );
    assert.match(
      event.end,
      /Z$/
    );
  } finally {
    globalThis.fetch =
      original;
  }
});

test("inbound reconciliation only operates on persistent mapped events and enforces SalonAI mutation permissions", async () => {
  const source =
    await readFile(
      new URL(
        "../integrations/calendar/calendarInboundReconciliationService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /ExternalCalendarEventLink\.find/
  );
  assert.match(
    source,
    /"appointment:update"/
  );
  assert.match(
    source,
    /"appointment:cancel"/
  );
  assert.match(
    source,
    /rescheduleAppointment/
  );
  assert.match(
    source,
    /changeAppointmentStatus/
  );
  assert.match(
    source,
    /enqueueCalendarSyncTask/
  );
  assert.equal(
    source.includes(
      "createManagedAppointment"
    ),
    false
  );
});

test("worker performs inbound reconciliation less frequently than outbound queue processing", async () => {
  const source =
    await readFile(
      new URL(
        "../integrations/calendar/calendarSyncWorkerService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /CALENDAR_SYNC_INBOUND_INTERVAL_MS/
  );
  assert.match(
    source,
    /reconcileAllEnabledCalendars/
  );
  assert.match(
    source,
    /processCalendarSyncBatch/
  );
});
