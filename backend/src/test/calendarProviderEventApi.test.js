import assert from "node:assert/strict";
import test from "node:test";

import ExternalCalendarEventLink from "../models/ExternalCalendarEventLink.js";
import {
  createProviderEvent,
  deleteProviderEvent,
  updateProviderEvent,
} from "../integrations/calendar/calendarProviderEventApi.js";
import {
  hashEvent,
} from "../integrations/calendar/calendarOutboundSyncService.js";

function event() {
  return {
    sourceType:
      "appointment",
    sourceId:
      "appointment-123",
    summary:
      "SalonAI — Cut and finish",
    start:
      "2026-10-01T09:00:00.000Z",
    end:
      "2026-10-01T10:00:00.000Z",
    timeZone:
      "Europe/London",
    visibility:
      "private",
    status:
      "confirmed",
    metadata: {
      appointmentId:
        "appointment-123",
      stylistId:
        "stylist-1",
      serviceId:
        "service-1",
      bookingSource:
        "website",
    },
  };
}

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

test("external event mapping is unique per connection and appointment", () => {
  const indexes =
    ExternalCalendarEventLink.schema.indexes();

  assert.equal(
    indexes.some(
      ([fields, options]) =>
        fields.connection === 1 &&
        fields.appointment === 1 &&
        options.unique === true
    ),
    true
  );
});

test("event hash changes when the canonical appointment event changes", () => {
  const original =
    event();
  const changed = {
    ...original,
    end:
      "2026-10-01T10:30:00.000Z",
  };

  assert.notEqual(
    hashEvent(original),
    hashEvent(changed)
  );
});

test("Google create uses deterministic provider id and recovers duplicate retry by update", async () => {
  const originalFetch =
    globalThis.fetch;
  const calls = [];

  globalThis.fetch =
    async (
      url,
      options
    ) => {
      calls.push({
        url:
          String(url),
        options,
      });

      if (
        calls.length === 1
      ) {
        return response(
          409,
          {
            error: {
              message:
                "The requested identifier already exists.",
            },
          }
        );
      }

      return response(
        200,
        {
          id:
            "93bc5e2186f2490d764fa9b85989b75b0f7cd22c",
          etag:
            "etag-2",
          updated:
            "2026-09-18T18:00:00Z",
        }
      );
    };

  try {
    const result =
      await createProviderEvent({
        provider: "google",
        calendarId:
          "work@example.com",
        accessToken:
          "secret-token",
        event: event(),
      });

    assert.equal(
      calls.length,
      2
    );
    assert.equal(
      calls[0].options
        .method,
      "POST"
    );

    const createBody =
      JSON.parse(
        calls[0].options
          .body
      );

    assert.match(
      createBody.id,
      /^[0-9a-f]{40}$/
    );
    assert.equal(
      createBody.visibility,
      "private"
    );
    assert.equal(
      JSON.stringify(
        createBody
      ).includes(
        "customer"
      ),
      false
    );

    assert.equal(
      calls[1].options
        .method,
      "PATCH"
    );
    assert.match(
      calls[1].url,
      new RegExp(
        `/events/${createBody.id}$`
      )
    );
    assert.equal(
      result.providerEventId,
      "93bc5e2186f2490d764fa9b85989b75b0f7cd22c"
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }
});

test("Outlook create targets selected calendar and supplies stable transactionId", async () => {
  const originalFetch =
    globalThis.fetch;
  const calls = [];

  globalThis.fetch =
    async (
      url,
      options
    ) => {
      calls.push({
        url:
          String(url),
        options,
      });

      return response(
        201,
        {
          id:
            "outlook-event-1",
          changeKey:
            "change-1",
          lastModifiedDateTime:
            "2026-09-18T18:00:00Z",
        }
      );
    };

  try {
    await createProviderEvent({
      provider:
        "outlook",
      calendarId:
        "calendar/a+b",
      accessToken:
        "secret-token",
      event: event(),
    });

    assert.equal(
      calls.length,
      1
    );
    assert.equal(
      calls[0].options
        .method,
      "POST"
    );
    assert.match(
      calls[0].url,
      /me\/calendars\/calendar%2Fa%2Bb\/events$/
    );

    const body =
      JSON.parse(
        calls[0].options
          .body
      );

    assert.match(
      body.transactionId,
      /^[0-9a-f-]{36}$/
    );
    assert.equal(
      body.sensitivity,
      "private"
    );
    assert.equal(
      body.showAs,
      "busy"
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }
});

test("provider update and delete use the known mapped event id", async () => {
  const originalFetch =
    globalThis.fetch;
  const calls = [];

  globalThis.fetch =
    async (
      url,
      options
    ) => {
      calls.push({
        url:
          String(url),
        options,
      });

      if (
        options.method ===
        "DELETE"
      ) {
        return response(
          204
        );
      }

      return response(
        200,
        {
          id:
            "known-event",
          etag: "v2",
        }
      );
    };

  try {
    await updateProviderEvent({
      provider: "google",
      calendarId:
        "primary",
      providerEventId:
        "known-event",
      accessToken:
        "secret-token",
      event: event(),
    });

    await deleteProviderEvent({
      provider: "google",
      calendarId:
        "primary",
      providerEventId:
        "known-event",
      accessToken:
        "secret-token",
    });

    assert.deepEqual(
      calls.map(
        (call) =>
          call.options.method
      ),
      [
        "PATCH",
        "DELETE",
      ]
    );

    assert.equal(
      calls.every(
        (call) =>
          call.url.endsWith(
            "/events/known-event"
          )
      ),
      true
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }
});
