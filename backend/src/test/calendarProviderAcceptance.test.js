import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarAcceptanceEvent,
  runCalendarProviderAcceptance,
} from "../integrations/calendar/calendarProviderAcceptanceService.js";

function fakeProvider({
  failUpdate = false,
} = {}) {
  const calls = [];
  let state =
    null;
  let deleted =
    false;

  return {
    calls,
    api: {
      async createProviderEvent(
        input
      ) {
        calls.push({
          operation:
            "create",
          ...input,
        });
        state = {
          ...input.event,
        };
        deleted =
          false;

        return {
          providerEventId:
            "acceptance-event",
        };
      },

      async getProviderEvent(
        input
      ) {
        calls.push({
          operation:
            "get",
          ...input,
        });

        return deleted
          ? {
              providerEventId:
                "acceptance-event",
              deleted: true,
              start: null,
              end: null,
            }
          : {
              providerEventId:
                "acceptance-event",
              deleted: false,
              start:
                state.start,
              end:
                state.end,
            };
      },

      async updateProviderEvent(
        input
      ) {
        calls.push({
          operation:
            "update",
          ...input,
        });

        if (failUpdate) {
          throw new Error(
            "simulated update failure"
          );
        }

        state = {
          ...input.event,
        };

        return {
          providerEventId:
            "acceptance-event",
        };
      },

      async deleteProviderEvent(
        input
      ) {
        calls.push({
          operation:
            "delete",
          ...input,
        });
        deleted =
          true;

        return {
          deleted: true,
        };
      },
    },
  };
}

test("calendar provider acceptance performs create/read/update/read/delete/read in the selected calendar only", async () => {
  const provider =
    fakeProvider();

  const result =
    await runCalendarProviderAcceptance({
      provider:
        "google",
      calendarId:
        "selected-calendar",
      accessToken:
        "acceptance-token",
      baseTime:
        new Date(
          "2026-10-01T08:01:00Z"
        ),
      providerApi:
        provider.api,
    });

  assert.equal(
    result.success,
    true
  );
  assert.deepEqual(
    provider.calls.map(
      (call) =>
        call.operation
    ),
    [
      "create",
      "get",
      "update",
      "get",
      "delete",
      "get",
    ]
  );
  assert.equal(
    provider.calls.every(
      (call) =>
        call.calendarId ===
        "selected-calendar"
    ),
    true
  );
  assert.equal(
    provider.calls.every(
      (call) =>
        call.accessToken ===
        "acceptance-token"
    ),
    true
  );
  assert.deepEqual(
    result.steps,
    [
      "create",
      "read_after_create",
      "update",
      "read_after_update",
      "delete",
      "verify_deleted",
    ]
  );
});

test("acceptance event is private-test shaped and scheduled in the future", () => {
  const base =
    new Date(
      "2026-10-01T08:01:00Z"
    );
  const event =
    buildCalendarAcceptanceEvent({
      baseTime:
        base,
      sourceId:
        "12345678-test",
      timeZone:
        "Europe/London",
    });

  assert.equal(
    event.sourceType,
    "calendar_acceptance"
  );
  assert.match(
    event.summary,
    /^\[SalonAI acceptance\]/
  );
  assert.equal(
    event.timeZone,
    "Europe/London"
  );
  assert.equal(
    new Date(
      event.start
    ).getTime() >
      base.getTime(),
    true
  );
  assert.equal(
    new Date(
      event.end
    ).getTime() -
      new Date(
        event.start
      ).getTime(),
    30 *
      60 *
      1000
  );
});

test("failed acceptance lifecycle attempts provider cleanup", async () => {
  const provider =
    fakeProvider({
      failUpdate: true,
    });

  await assert.rejects(
    () =>
      runCalendarProviderAcceptance({
        provider:
          "outlook",
        calendarId:
          "selected-calendar",
        accessToken:
          "acceptance-token",
        providerApi:
          provider.api,
      }),
    /simulated update failure/
  );

  assert.equal(
    provider.calls.some(
      (call) =>
        call.operation ===
        "delete"
    ),
    true
  );
});

test("acceptance service rejects unsupported providers before any external request", async () => {
  const provider =
    fakeProvider();

  await assert.rejects(
    () =>
      runCalendarProviderAcceptance({
        provider:
          "ical",
        calendarId:
          "calendar",
        accessToken:
          "token",
        providerApi:
          provider.api,
      }),
    /google or outlook/
  );

  assert.equal(
    provider.calls.length,
    0
  );
});
