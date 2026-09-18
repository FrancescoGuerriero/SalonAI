import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import ExternalCalendarConnection from "../models/ExternalCalendarConnection.js";
import {
  calendarWebhookToken,
  ensureCalendarWebhookSubscription,
  verifyCalendarWebhookToken,
} from "../integrations/calendar/calendarWebhookProviderService.js";

function response(status, body = null) {
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

function withWebhookEnv(run) {
  const previous = {
    enabled:
      process.env.CALENDAR_WEBHOOKS_ENABLED,
    base:
      process.env.CALENDAR_WEBHOOK_BASE_URL,
    secret:
      process.env.CALENDAR_WEBHOOK_SECRET,
  };

  process.env.CALENDAR_WEBHOOKS_ENABLED =
    "true";
  process.env.CALENDAR_WEBHOOK_BASE_URL =
    "https://salonai.example";
  process.env.CALENDAR_WEBHOOK_SECRET =
    "calendar-webhook-test-secret-that-is-long-enough";

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [
        key,
        value,
      ] of [
        [
          "CALENDAR_WEBHOOKS_ENABLED",
          previous.enabled,
        ],
        [
          "CALENDAR_WEBHOOK_BASE_URL",
          previous.base,
        ],
        [
          "CALENDAR_WEBHOOK_SECRET",
          previous.secret,
        ],
      ]) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] =
            value;
        }
      }
    });
}

test("calendar webhook token is connection-scoped and verifiable", async () => {
  await withWebhookEnv(
    async () => {
      const token =
        calendarWebhookToken({
          connectionId:
            "connection-1",
          provider:
            "google",
          calendarId:
            "primary",
        });

      assert.equal(
        verifyCalendarWebhookToken({
          actual: token,
          connectionId:
            "connection-1",
          provider:
            "google",
          calendarId:
            "primary",
        }),
        true
      );

      assert.equal(
        verifyCalendarWebhookToken({
          actual: token,
          connectionId:
            "connection-2",
          provider:
            "google",
          calendarId:
            "primary",
        }),
        false
      );
    }
  );
});

test("Google webhook subscription watches only the selected calendar", async () => {
  await withWebhookEnv(
    async () => {
      const original =
        globalThis.fetch;
      let request;

      globalThis.fetch =
        async (
          url,
          options
        ) => {
          request = {
            url,
            options,
          };

          return response(
            200,
            {
              id:
                "google-channel",
              resourceId:
                "google-resource",
              expiration:
                String(
                  Date.now() +
                    6 *
                      24 *
                      60 *
                      60 *
                      1000
                ),
            }
          );
        };

      const connection = {
        _id:
          "connection-google",
        provider:
          "google",
        calendarId:
          "staff-calendar@example.com",
        subscriptionId:
          "",
        subscriptionResourceId:
          "",
        subscriptionExpiresAt:
          null,
        async save() {},
      };

      try {
        const result =
          await ensureCalendarWebhookSubscription({
            connection,
            accessToken:
              "token",
          });

        const body =
          JSON.parse(
            request.options.body
          );

        assert.match(
          request.url,
          /staff-calendar%40example\.com\/events\/watch$/
        );
        assert.equal(
          body.type,
          "web_hook"
        );
        assert.equal(
          body.address,
          "https://salonai.example/api/calendar-webhooks/google"
        );
        assert.equal(
          body.params.ttl,
          "604800"
        );
        assert.equal(
          result.subscriptionId,
          "google-channel"
        );
        assert.equal(
          connection.subscriptionResourceId,
          "google-resource"
        );
      } finally {
        globalThis.fetch =
          original;
      }
    }
  );
});

test("Outlook webhook subscription is wake-only and mailbox scoped", async () => {
  await withWebhookEnv(
    async () => {
      const original =
        globalThis.fetch;
      let request;

      globalThis.fetch =
        async (
          url,
          options
        ) => {
          request = {
            url,
            options,
          };

          const body =
            JSON.parse(
              options.body
            );

          return response(
            201,
            {
              id:
                "graph-subscription",
              expirationDateTime:
                body.expirationDateTime,
            }
          );
        };

      const connection = {
        _id:
          "connection-outlook",
        provider:
          "outlook",
        calendarId:
          "selected-calendar",
        subscriptionId:
          "",
        subscriptionResourceId:
          "",
        subscriptionExpiresAt:
          null,
        async save() {},
      };

      try {
        await ensureCalendarWebhookSubscription({
          connection,
          accessToken:
            "token",
        });

        const body =
          JSON.parse(
            request.options.body
          );

        assert.equal(
          request.url,
          "https://graph.microsoft.com/v1.0/subscriptions"
        );
        assert.equal(
          body.resource,
          "/me/events"
        );
        assert.equal(
          body.changeType,
          "created,updated,deleted"
        );
        assert.equal(
          body.notificationUrl,
          "https://salonai.example/api/calendar-webhooks/outlook"
        );
        assert.equal(
          body.lifecycleNotificationUrl,
          body.notificationUrl
        );
        assert.equal(
          body.clientState,
          calendarWebhookToken({
            connectionId:
              connection._id,
            provider:
              "outlook",
            calendarId:
              connection.calendarId,
          })
        );

        const lifetime =
          new Date(
            body.expirationDateTime
          ).getTime() -
          Date.now();

        assert.equal(
          lifetime <
            7 *
              24 *
              60 *
              60 *
              1000,
          true
        );
      } finally {
        globalThis.fetch =
          original;
      }
    }
  );
});

test("webhook notifications can only request reconciliation, not mutate appointments", async () => {
  const source =
    await readFile(
      new URL(
        "../integrations/calendar/calendarWebhookService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /reconcileRequestedAt/
  );
  assert.match(
    source,
    /verifyCalendarWebhookToken/
  );
  assert.equal(
    source.includes(
      "rescheduleAppointment"
    ),
    false
  );
  assert.equal(
    source.includes(
      "changeAppointmentStatus"
    ),
    false
  );
  assert.equal(
    source.includes(
      "Appointment."
    ),
    false
  );
});

test("calendar worker prioritizes durable webhook wake requests while retaining periodic fallback", async () => {
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
    /reconcileRequestedCalendars/
  );
  assert.match(
    source,
    /requestCalendarSyncWake/
  );
  assert.match(
    source,
    /inboundDue/
  );
  assert.match(
    source,
    /reconcileAllEnabledCalendars/
  );
});

test("calendar connection stores provider subscription and durable wake state", () => {
  const paths =
    ExternalCalendarConnection.schema.paths;

  assert.equal(
    Boolean(
      paths.subscriptionId
    ),
    true
  );
  assert.equal(
    Boolean(
      paths.subscriptionResourceId
    ),
    true
  );
  assert.equal(
    Boolean(
      paths.subscriptionExpiresAt
    ),
    true
  );
  assert.equal(
    Boolean(
      paths.reconcileRequestedAt
    ),
    true
  );
  assert.equal(
    Boolean(
      paths.lastWebhookAt
    ),
    true
  );
});
