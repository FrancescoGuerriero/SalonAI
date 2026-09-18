import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ExternalCalendarConnection from "../models/ExternalCalendarConnection.js";
import {
  decryptCalendarSecret,
  encryptCalendarSecret,
} from "../integrations/calendar/calendarCredentialCrypto.js";

test("calendar connection secrets are excluded by default", () => {
  for (const path of [
    "encryptedAccessToken",
    "encryptedRefreshToken",
    "syncCursor",
    "subscriptionId",
  ]) {
    assert.equal(
      ExternalCalendarConnection.schema.path(path).options.select,
      false,
      `${path} must not be selected by default`
    );
  }
});

test("calendar credentials round-trip through authenticated encryption", () => {
  const previous =
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;

  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY =
    Buffer.alloc(32, 7).toString("base64");

  try {
    const encrypted =
      encryptCalendarSecret(
        "refresh-token-secret"
      );

    assert.notEqual(
      encrypted,
      "refresh-token-secret"
    );
    assert.equal(
      decryptCalendarSecret(
        encrypted
      ),
      "refresh-token-secret"
    );
  } finally {
    if (previous === undefined) {
      delete process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.CALENDAR_TOKEN_ENCRYPTION_KEY =
        previous;
    }
  }
});

test("staff calendar UI exposes independent Google and Outlook connection controls", async () => {
  const source =
    await readFile(
      new URL(
        "../../frontend/src/components/calendar/StaffCalendarConnections.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /Google Calendar/
  );
  assert.match(
    source,
    /Microsoft Outlook/
  );
  assert.match(
    source,
    /Connect/
  );
  assert.match(
    source,
    /Reconnect/
  );
  assert.match(
    source,
    /Disconnect/
  );
  assert.match(
    source,
    /Sync/
  );
  assert.match(
    source,
    /SalonAI remains the appointment source of truth/
  );
});

test("calendar OAuth callbacks are separated from authenticated management routes", async () => {
  const app =
    await readFile(
      new URL(
        "../app.js",
        import.meta.url
      ),
      "utf8"
    );

  const futureRoutes =
    await readFile(
      new URL(
        "../features/futureFeatureRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    app,
    /"\/api\/calendar-oauth"/
  );
  assert.match(
    futureRoutes,
    /"\/calendar-connections"/
  );
});
