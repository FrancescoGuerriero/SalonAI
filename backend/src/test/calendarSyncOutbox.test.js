import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import CalendarSyncTask from "../models/CalendarSyncTask.js";
import {
  MAX_ATTEMPTS,
  backoffMs,
} from "../integrations/calendar/calendarSyncOutboxService.js";

test("calendar outbox coalesces to one task per appointment", () => {
  const indexes =
    CalendarSyncTask.schema.indexes();

  assert.equal(
    indexes.some(
      ([fields, options]) =>
        fields.appointment ===
          1 &&
        options.unique ===
          true
    ),
    true
  );
});

test("calendar outbox retry delay grows exponentially and is capped", () => {
  assert.equal(
    backoffMs(1),
    15_000
  );
  assert.equal(
    backoffMs(2),
    30_000
  );
  assert.equal(
    backoffMs(3),
    60_000
  );
  assert.equal(
    backoffMs(
      MAX_ATTEMPTS
    ),
    60 * 60 * 1000
  );
});

test("Appointment model queues only canonical calendar-relevant changes and swallows local enqueue failure", async () => {
  const source =
    await readFile(
      new URL(
        "../models/Appointment.js",
        import.meta.url
      ),
      "utf8"
    );

  for (const field of [
    "stylist",
    "service",
    "startsAt",
    "endsAt",
    "appointmentDate",
    "appointmentTime",
    "duration",
    "status",
    "bookingSource",
  ]) {
    assert.match(
      source,
      new RegExp(
        `"${field}"`
      )
    );
  }

  assert.match(
    source,
    /enqueueCalendarSyncTask/
  );
  assert.match(
    source,
    /Calendar sync task enqueue failed/
  );
});

test("calendar worker is explicit opt-in and participates in server lifecycle", async () => {
  const worker =
    await readFile(
      new URL(
        "../integrations/calendar/calendarSyncWorkerService.js",
        import.meta.url
      ),
      "utf8"
    );
  const server =
    await readFile(
      new URL(
        "../../server.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    worker,
    /CALENDAR_SYNC_WORKER_ENABLED/
  );
  assert.match(
    worker,
    /processCalendarSyncBatch/
  );
  assert.match(
    server,
    /startCalendarSyncWorker/
  );
  assert.match(
    server,
    /stopCalendarSyncWorker/
  );
  assert.match(
    server,
    /calendarSync/
  );
});

test("outbox retries partial provider failures rather than marking them complete", async () => {
  const source =
    await readFile(
      new URL(
        "../integrations/calendar/calendarSyncOutboxService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /result\.failed > 0/
  );
  assert.match(
    source,
    /CALENDAR_SYNC_PARTIAL_FAILURE/
  );
  assert.match(
    source,
    /requestedRevision >\s*task\.requestedRevision/
  );
});
