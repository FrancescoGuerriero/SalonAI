import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarReadinessReport,
} from "../integrations/calendar/calendarReadinessService.js";

const VALID_KEY =
  "a".repeat(64);

function env(
  overrides = {}
) {
  return {
    CALENDAR_TOKEN_ENCRYPTION_KEY:
      VALID_KEY,
    CALENDAR_WEBHOOKS_ENABLED:
      "false",
    ...overrides,
  };
}

function connection(
  overrides = {}
) {
  return {
    provider: "google",
    status: "connected",
    syncEnabled: true,
    calendarId: "primary",
    subscriptionExpiresAt:
      null,
    lastSyncError: "",
    accountEmail:
      "private@example.com",
    ...overrides,
  };
}

test("calendar readiness passes with one configured connected sync-enabled provider", () => {
  const report =
    buildCalendarReadinessReport({
      providerAvailability: [
        {
          provider:
            "google",
          configured: true,
        },
        {
          provider:
            "outlook",
          configured: false,
        },
      ],
      connections: [
        connection(),
      ],
      env: env(),
      now: new Date(
        "2026-09-26T10:00:00Z"
      ),
    });

  assert.equal(
    report.readyForAcceptance,
    true
  );
  assert.equal(
    report.acceptanceCandidateCount,
    1
  );
  assert.deepEqual(
    report.blockers,
    []
  );
});

test("calendar readiness can pass for Outlook even when Google is not configured", () => {
  const report =
    buildCalendarReadinessReport({
      providerAvailability: [
        {
          provider:
            "google",
          configured: false,
        },
        {
          provider:
            "outlook",
          configured: true,
        },
      ],
      connections: [
        connection({
          provider:
            "outlook",
        }),
      ],
      env: env(),
    });

  assert.equal(
    report.readyForAcceptance,
    true
  );
  assert.equal(
    report.providers.find(
      (provider) =>
        provider.provider ===
        "outlook"
    )
      .acceptanceCandidateCount,
    1
  );
});

test("calendar readiness fails closed when no connected sync-enabled calendar exists", () => {
  const report =
    buildCalendarReadinessReport({
      providerAvailability: [
        {
          provider:
            "google",
          configured: true,
        },
        {
          provider:
            "outlook",
          configured: false,
        },
      ],
      connections: [
        connection({
          syncEnabled: false,
        }),
      ],
      env: env(),
    });

  assert.equal(
    report.readyForAcceptance,
    false
  );
  assert.equal(
    report.blockers.includes(
      "connectedSyncEnabledCalendar"
    ),
    true
  );
});

test("calendar readiness fails closed for invalid token encryption configuration", () => {
  const report =
    buildCalendarReadinessReport({
      providerAvailability: [
        {
          provider:
            "google",
          configured: true,
        },
        {
          provider:
            "outlook",
          configured: false,
        },
      ],
      connections: [
        connection(),
      ],
      env: env({
        CALENDAR_TOKEN_ENCRYPTION_KEY:
          "too-short",
      }),
    });

  assert.equal(
    report.readyForAcceptance,
    false
  );
  assert.equal(
    report.blockers.includes(
      "tokenEncryptionKey"
    ),
    true
  );
});

test("calendar readiness validates webhook configuration only when webhooks are enabled", () => {
  const report =
    buildCalendarReadinessReport({
      providerAvailability: [
        {
          provider:
            "google",
          configured: true,
        },
        {
          provider:
            "outlook",
          configured: false,
        },
      ],
      connections: [
        connection(),
      ],
      env: env({
        CALENDAR_WEBHOOKS_ENABLED:
          "true",
        CALENDAR_WEBHOOK_BASE_URL:
          "http://example.com",
        CALENDAR_WEBHOOK_SECRET:
          "short",
      }),
    });

  assert.equal(
    report.readyForAcceptance,
    false
  );
  assert.equal(
    report.blockers.includes(
      "webhookConfiguration"
    ),
    true
  );
});

test("calendar readiness output does not expose account identities or calendar ids", () => {
  const report =
    buildCalendarReadinessReport({
      providerAvailability: [
        {
          provider:
            "google",
          configured: true,
        },
        {
          provider:
            "outlook",
          configured: false,
        },
      ],
      connections: [
        connection({
          accountEmail:
            "sensitive@example.com",
          calendarId:
            "sensitive-calendar-id",
        }),
      ],
      env: env(),
    });

  const serialised =
    JSON.stringify(
      report
    );

  assert.equal(
    serialised.includes(
      "sensitive@example.com"
    ),
    false
  );
  assert.equal(
    serialised.includes(
      "sensitive-calendar-id"
    ),
    false
  );
});
