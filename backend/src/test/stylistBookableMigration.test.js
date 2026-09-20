import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normaliseLegacyStylistBookability,
} from "../../scripts/migrateStylistBookable.js";

test("stylist bookable migration preserves canonical values and maps legacy state", () => {
  assert.deepEqual(
    normaliseLegacyStylistBookability({
      bookable: true,
      acceptsAppointments: false,
    }),
    {
      bookable: true,
    }
  );

  assert.deepEqual(
    normaliseLegacyStylistBookability({
      acceptsAppointments: true,
    }),
    {
      bookable: true,
    }
  );

  assert.deepEqual(
    normaliseLegacyStylistBookability({
      acceptsAppointments: false,
    }),
    {
      bookable: false,
    }
  );

  assert.deepEqual(
    normaliseLegacyStylistBookability({}),
    {
      bookable: false,
    }
  );
});

test("live employee booking eligibility uses bookable and not acceptsAppointments", async () => {
  const paths = [
    "../models/Stylist.js",
    "../services/stylistBookingEligibilityService.js",
    "../controllers/appointmentController.js",
    "../controllers/stylistController.js",
    "../features/appointments/appointmentManagementService.js",
    "../controllers/adminUserController.js",
  ];

  for (const relativePath of paths) {
    const source =
      await readFile(
        new URL(
          relativePath,
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /\bbookable\b/,
      `${relativePath} must use canonical bookable state`
    );

    assert.doesNotMatch(
      source,
      /acceptsAppointments/,
      `${relativePath} must not use legacy acceptsAppointments`
    );
  }
});

test("shared stylist eligibility makes global bookable authoritative", async () => {
  const source =
    await readFile(
      new URL(
        "../services/stylistBookingEligibilityService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /isActive:\s*true,[\s\S]*bookable:\s*true/
  );
  assert.match(
    source,
    /stylist\.isActive === true[\s\S]*stylist\.bookable === true/
  );
});

test("stylist migration is dry-run-first and removes the legacy field on apply", async () => {
  const source =
    await readFile(
      new URL(
        "../../scripts/migrateStylistBookable.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /STYLIST_BOOKABLE_MIGRATION_CONFIRM/
  );
  assert.match(
    source,
    /RUN_STYLIST_BOOKABLE_MIGRATION/
  );
  assert.match(
    source,
    /\$unset:\s*\{[\s\S]*acceptsAppointments/
  );
  assert.match(
    source,
    /remaining !== 0/
  );
});
