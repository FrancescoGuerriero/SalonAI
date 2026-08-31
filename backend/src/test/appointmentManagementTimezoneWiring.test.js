import assert
  from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import test
  from "node:test";

const SERVICE_URL =
  new URL(
    "../features/appointments/appointmentManagementService.js",
    import.meta.url
  );

test(
  "appointment management uses salon timezone semantics",
  async () => {
    const source =
      await readFile(
        SERVICE_URL,
        "utf8"
      );

    for (
      const helper of [
        "combineSalonDateAndTime",
        "formatSalonTime",
        "salonDateAnchor",
        "salonDayBounds",
        "addSalonDays",
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          `\\b${helper}\\b`
        )
      );
    }

    for (
      const forbidden of [
        ".setHours(",
        ".getHours()",
        ".getMinutes()",
        "startOfDay(",
        "endOfDay(",
        "addDays(",
      ]
    ) {
      assert.equal(
        source.includes(
          forbidden
        ),
        false,
        `management service must not use ${forbidden}`
      );
    }
  }
);
